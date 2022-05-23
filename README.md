# @atomico/postcss-tokens

Allows importing tokens as json files to be embedded in CSS as customProperties.

## Usage

```js
import postcss from "postcss";
import tokens from "@atomico/postcss-tokens";

const result = await postcss(tokens()).process(
    `@tokens "./tokens.json" ( prefix: "my-dsprefix" );`,
    {
        from: "./tests/demo.css",
    }
);

console.log(result.css);
```

## Syntax

```css
@tokens "./tokens.json" (prefix: my-dsprefix);
```

## Options

### Prefix

create the custom properties with the assigned prefix

```css
@tokens "./tokens.json" (prefix: my-dsprefix);
```

**prefix can be defined globally when instantiating the plugin, example:**

```js
postcss(tokens({ prefix: "my-ds" }));
```

### Default

IF croot is equal to `:host`, a default value will be defined for each custom properties depending on the token

```css
@tokens "./tokens.json" (prefix: my-dsprefix);
```

### Use

allows to filter the tokens to use

```css
@tokens "./tokens.json" (use: "size|font|color.primary");
```
