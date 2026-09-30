import type { Preview } from "@storybook/react-vite";
import "./preview.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: {
      expanded: true,
      sort: "requiredFirst",
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      toc: true,
    },
    options: {
      storySort: {
        order: ["Introduction", "Components", ["OTP input", "Rating input", "Currency input"]],
      },
    },
  },
  // Every input honours page-level direction (fill origin, caret movement,
  // slot order), so the toggle is a global toolbar item rather than a per-story
  // control — the same idea as the playground's page-wide RTL checkbox.
  globalTypes: {
    direction: {
      description: "Text direction",
      toolbar: {
        title: "Direction",
        icon: "transfer",
        items: [
          { value: "ltr", title: "LTR", right: "left to right" },
          { value: "rtl", title: "RTL", right: "right to left" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    direction: "ltr",
  },
  decorators: [
    (Story, context) => (
      <div dir={context.globals.direction === "rtl" ? "rtl" : "ltr"}>
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
};

export default preview;
