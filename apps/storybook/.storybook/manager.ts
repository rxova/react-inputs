import { addons } from "storybook/manager-api";
import { create } from "storybook/theming/create";

addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "rxova inputs",
    brandUrl: "https://rxova.dev",
    brandImage: "logo.svg",
    brandTarget: "_self",
    fontBase: "system-ui, sans-serif",
    fontCode: "ui-monospace, monospace",
    colorPrimary: "#2684d9",
    colorSecondary: "#0066cc",
  }),
});
