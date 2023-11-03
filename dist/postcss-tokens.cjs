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

const Alias = {
  "<": "greater-than",
  ">": "less-than",
  "=": "is",
  "!=": "is-not",
  "|": "or",
  "&": "and"
};
const transform = (data, options) => {
  const customProperties = createCustomProperties(data);
  const rules = {};
  const search = options.use || options.filter;
  const regExp = search ? RegExp(`^(${search})(-){0,}`) : null;
  const prefix = `--${options.prefix ? `${options.prefix}--` : ""}`;
  for (const prop in customProperties) {
    const { value, attrs, props } = customProperties[prop];
    const selector = options.scope === ":root" ? options.scope : getSelector(attrs, options.scope);
    if (regExp && !regExp.test(prop))
      continue;
    const nextProp = regExp ? prop.replace(regExp, "") : prop;
    if (!nextProp)
      continue;
    rules[selector] = rules[selector] || {};
    const nextValue = value.replace(/([\$]+){1,2}([\w\-]+)/g, (_, type, variable) => {
      const inRoot = customProperties[variable];
      return type === "$" && inRoot && options.scope != ":root" ? `var(--${variable.replace(regExp, "")})` : `var(${prefix}${variable})`;
    });
    if (options.scope === ":root") {
      rules[selector][`${prefix}${prop}`] = nextValue != value ? nextValue : value;
    } else {
      rules[selector][`--${props.join("-")}`] = nextValue != value ? nextValue : `var(${prefix}${prop})`;
    }
  }
  return objectToCss(rules);
};
const objectToCss = (rules) => {
  let css = "";
  for (const selector in rules) {
    let props = "";
    for (const prop in rules[selector]) {
      props += `${prop}:${rules[selector][prop]};`;
    }
    if (props)
      css += `${selector}{${props}}`;
  }
  return css;
};
const getTokens = (value) => {
  value = value + " ";
  let currentValue = "";
  const tokens = [];
  for (let i = 0; i < value.length; i++) {
    switch (value[i]) {
      case "=":
      case "(":
      case ")":
      case ">":
      case "<":
      case ":":
      case "|":
      case "!":
        if (currentValue)
          tokens.push(currentValue);
        currentValue = "";
        if (value[i] === "!" && value[i + 1] === "=") {
          tokens.push("!=");
          i++;
          break;
        }
        tokens.push(value[i]);
        break;
      case " ":
        if (currentValue)
          tokens.push(currentValue);
        currentValue = "";
        break;
      default:
        currentValue += value[i];
        break;
    }
  }
  const list = tokens.map((value2) => value2 === "(" ? "[" : value2 === ")" ? "]" : value2.startsWith('"') ? value2 : `"${value2}"`);
  return JSON.parse(`[${list.join(",").replace(/\[,/g, "[").replace(/,\]/g, "]")}]`);
};
const customPropertyToHumanName = (name) => {
  if (name === "=")
    return "";
  const [first, ...tokens] = getTokens(name);
  if (!Array.isArray(first))
    return first;
  return [first.length > 1 ? first : ["=", first], tokens].flat(10).map((value) => {
    value = value.replace(/^(@|\^)/, "");
    return value in Alias ? Alias[value] : value;
  }).join("-");
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
  const selector = attrs.map(getTokens).flat(1).map(([attr, exp, value]) => {
    if (attr.startsWith("^")) {
      scope = ":host-context";
      attr = attr.slice(1);
    }
    return exp === "!=" ? `:not([${attr}="${value}"])` : `[${attr}${exp ? `${exp}"${value}"` : ""}]`;
  }).join("");
  return `${scope}${scope.startsWith(":host") && selector ? `(${selector})` : `${selector}`}`;
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
  attrs.replace(/([\w]+)\(([^\)]+)\)/g, (_, attr, value) => {
    options[attr] = value.trim();
    return "";
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
