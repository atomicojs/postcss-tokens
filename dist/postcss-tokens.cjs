'use strict';

var path = require('path');
var promises = require('fs/promises');
var yaml = require('js-yaml');
var postcss = require('postcss');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var yaml__default = /*#__PURE__*/_interopDefaultLegacy(yaml);
var postcss__default = /*#__PURE__*/_interopDefaultLegacy(postcss);

const load = async (file) => yaml__default["default"].load(await promises.readFile(file, "utf8"));

const SPACE = " ";
const REGEXP_SELECTOR = String.raw`(?:(?:\!|\^|\~|\$|\*|\|)?(?:=))`;
const REGEXP_ATTRIBUTE = String.raw`(?: *(>|<|:) *)`;
const REGEXP = RegExp(String.raw`([\w\-\*]+)(:?(${REGEXP_SELECTOR}|${REGEXP_ATTRIBUTE})(.*))?`);
const parse = (value) => {
  const text = value.replace(/\s+/g, " ") + " ";
  let current = "";
  let isOpen = 0;
  let ref;
  const refs = [];
  for (let i = 0; i < text.length; i++) {
    const value2 = text[i];
    if (value2 === "(" && !isOpen++) {
      ref = { type: "attr", value: "", parts: [], raw: "" };
      if (text[i - 1] !== SPACE) {
        ref.type = current.trim();
      }
      current = "";
      refs.push(ref);
      continue;
    }
    if (value2 === ")" && !--isOpen) {
      ref.value = current.trim();
      const test = ref.value.match(REGEXP);
      if (test) {
        const [, attr, , operator, , value3] = test;
        ref.parts.push(attr, operator ? operator.trim() : void 0, value3);
        ref.raw = `${ref.type || ""}(${ref.value})`;
      }
      ref = null;
      current = "";
      continue;
    }
    if (value2 === SPACE && !isOpen && current) {
      refs.push({
        type: "operator",
        value: current.trim(),
        parts: [],
        raw: ""
      });
      current = "";
    }
    current += value2;
  }
  return refs;
};

const Alias = {
  "<": "greater-than",
  ">": "less-than",
  "=": "is",
  "!=": "is-not",
  "|": "or",
  "&": "and",
  "slot=*": "any-slot"
};
const transform = (data, options) => {
  const customProperties = createCustomProperties(data);
  const rules = {};
  const search = options.use || options.filter;
  const regExp = search ? RegExp(`^(${search})(-){0,}`) : null;
  const prefix = `--${options.prefix ? `${options.prefix}--` : ""}`;
  return objectToCss(mapTransform(customProperties, options, rules, regExp, prefix, true));
};
const mapTransform = (customProperties, options, rules, regExp, prefix, isParent, parentPrefix = "", parentSuffix = "") => {
  for (const prop in customProperties) {
    const { value, attrs, props } = customProperties[prop];
    const [selector, selectorAttrs, excludeAttrs] = options.scope === ":root" ? [options.scope, []] : getSelector(attrs, options.scope);
    if (regExp && !regExp.test(prop))
      continue;
    const token = regExp ? prop.replace(regExp, "") : prop;
    if (!token)
      continue;
    rules[selector] = rules[selector] || {};
    if (selector.startsWith("@") && isParent) {
      mapTransform({
        [prop]: {
          ...customProperties[prop],
          attrs: excludeAttrs
        }
      }, options, rules[selector], regExp, prefix, false);
      continue;
    }
    const nextValue = value.replace(/([\$]+){1,2}([\w\-]+)/g, (_, type, variable) => {
      const inRoot = customProperties[variable];
      return type === "$" && inRoot && options.scope != ":root" ? `var(--${variable.replace(regExp, "")})` : `var(${prefix}${variable})`;
    });
    if (options.scope === ":root") {
      rules[selector][`${prefix}${prop}`] = nextValue != value ? nextValue : value;
    } else {
      const isHostContext = selector.startsWith(":host-context");
      const isSlotted = selector.startsWith("::slotted");
      let id = parentPrefix + props.join("-").replace(regExp, "") + parentSuffix;
      if (isHostContext) {
        const token2 = selectorAttrs.map((value2) => value2.replace(/\[/g, "(").replace(/\]/g, ")")).map(customPropertyToHumanName).reduce((prop2, value2) => prop2.replace(`--${value2}`, ""), prop);
        if (options.bind) {
          rules[selector][`--_${token2}`] = nextValue != value ? nextValue : `var(${prefix}${prop})`;
        } else {
          rules[selector][`${prefix}${token2}`] = nextValue != value ? nextValue : `var(${prefix}${prop})`;
        }
      } else if (isSlotted) {
        if (excludeAttrs.length) {
          mapTransform({
            [prop]: {
              ...customProperties[prop],
              attrs: excludeAttrs,
              props: [...customProperties[prop].props]
            }
          }, {
            ...options,
            bind: false
          }, rules, regExp, prefix, false, "", customProperties[prop].alias[0] ? `--${customProperties[prop].alias[0]}` : "");
          continue;
        }
        const idSlot = `--${prop}`;
        rules[":host"][idSlot] = `var(${prefix}${prop})`;
        rules[selector][`--${id}`] = `var(${idSlot})`;
      } else {
        if (nextValue != value) {
          rules[selector][`--${id}`] = nextValue;
        } else if (!isSlotted && options.bind && selectorAttrs.length) {
          rules[selector][`--_${token}`] = `var(${prefix}${prop})`;
          rules[selector][`--_${id}`] = `var(--_${token})`;
        } else if (!isSlotted && options.bind) {
          rules[selector][`--_${token}`] = `var(${prefix}${prop})`;
          rules[selector][`--${id}`] = `var(--_${token})`;
        } else {
          rules[selector][`--${id}`] = `var(${prefix}${prop})`;
        }
      }
    }
  }
  return rules;
};
const objectToCss = (rules) => {
  let css = "";
  for (const selector in rules) {
    let props = "";
    for (const prop in rules[selector]) {
      if (typeof rules[selector][prop] === "object") {
        props += objectToCss({
          [prop]: rules[selector][prop]
        });
      } else {
        props += `${prop}:${rules[selector][prop]};`;
      }
    }
    if (props)
      css += `${selector}{${props}}`;
  }
  return css;
};
const customPropertyToHumanName = (name) => {
  if (name === "=")
    return "";
  const tokens = parse(name);
  if (tokens?.[0]?.type === "operator")
    return tokens?.[0]?.value;
  return tokens.map(({ type, parts: [attr, operator = "=", value] }) => {
    if (type === "slot") {
      if (attr === "*") {
        return [Alias["slot=*"]];
      }
      value = attr;
      attr = "slot";
    }
    const alias = Alias[operator] || "";
    return value ? [attr, alias, value] : [alias, attr];
  }).flat(1).join("-");
};
const createCustomProperties = (data, customProperties = {}, currentAttrs = [], currentProps = [], currentAlias = []) => {
  for (const prop in data) {
    const value = data[prop];
    const alia = customPropertyToHumanName(prop);
    const [attrs, props, alias] = prop === "=" ? [currentAttrs, currentProps, currentAlias] : prop != alia ? [
      [...currentAttrs, prop],
      currentProps,
      [...currentAlias, alia]
    ] : [currentAttrs, [...currentProps, prop], currentAlias];
    if (typeof value === "object") {
      createCustomProperties(value, customProperties, attrs, props, alias);
    } else {
      const id = props.join("-") + (alias.length ? "--" + alias.join("--") : "");
      customProperties[id] = {
        value: value.toString(),
        attrs,
        props,
        alias
      };
    }
  }
  return customProperties;
};
function getSelector(attrs, scope = ":host") {
  const nextAttrs = attrs.map(parse).flat(1);
  const noAttrs = nextAttrs.filter((ref) => ref.type !== "");
  const excludeAttrs = noAttrs.length ? nextAttrs.filter((ref) => !ref.type).map((ref) => ref.raw) : [];
  const selector = (noAttrs.length ? noAttrs : nextAttrs).sort(({ parts: [attr1] }, { parts: [attr2] }) => attr1 > attr2 ? 1 : attr1 < attr2 ? -1 : 0).map(({ type, parts: [attr, operator, value] }) => {
    let prefix = "[";
    let suffix = "]";
    switch (type) {
      case "slot": {
        scope = "::slotted";
        if (attr === "*") {
          return "*";
        }
        if (!operator) {
          value = attr;
          attr = "slot";
          operator = "=";
        }
        break;
      }
      case "container":
      case "media": {
        scope = `@${type} `;
        prefix = "";
        suffix = "";
        break;
      }
      case "context": {
        scope = ":host-context";
        break;
      }
    }
    return operator === "!=" ? `:not([${attr}=${value}])` : `${prefix}${attr}${operator ? `${operator}${value}` : ""}${suffix}`;
  });
  return [
    `${scope}${/^(:host|::slotted|@)/.test(scope) && selector.length ? `(${selector.join("")})` : `${selector.join("")}`}`,
    selector,
    excludeAttrs
  ];
}

async function replace(atRule, { load: load2, ...rootOptions }) {
  const file = atRule.source.input.file;
  const test = atRule.params.match(/(?:"([^"]+)"|'([^']+)')\s*(.+){0,1}/);
  if (!test)
    return;
  let [, source, , attrs = ""] = test;
  const options = {
    ...rootOptions
  };
  parse(attrs).forEach(({ type, value }) => {
    if (type === "operator") {
      options[value] = true;
    } else {
      options[type] = value;
    }
  });
  const dirname = path__default["default"].dirname(file);
  const data = await load2(path__default["default"].join(dirname, source), file);
  const rules = transform(data, options);
  atRule.replaceWith(postcss__default["default"].parse(rules));
}
const postcssTokens = (options) => ({
  postcssPlugin: "@atomico/postcss-tokens",
  AtRule: {
    tokens: (atRule) => replace(atRule, {
      ...options,
      async load(file, from) {
        let data;
        if (options?.load) {
          data = await options.load(file, from);
        }
        return data ? data : load(file);
      }
    })
  }
});
postcssTokens.postcss = true;

module.exports = postcssTokens;
