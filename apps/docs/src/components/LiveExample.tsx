import { LiveProvider, LiveEditor, LivePreview, LiveError } from "react-live";
import { themes } from "prism-react-renderer";
import scope from "./live-scope";

/**
 * Editable, running examples — the thing this docs site exists for.
 *
 * Starlight has no equivalent of Docusaurus's theme-live-codeblock, so this is
 * a direct replacement built on react-live, which is what that theme wrapped
 * anyway. Authors keep writing ```tsx live fences; remark-live-code rewrites
 * them into this component at build time (see src/plugins/remark-live-code.mjs).
 *
 * `noInline` stays false to match the Docusaurus behaviour the existing 29
 * blocks were written against: a block is a bare `function Demo() { ... }`
 * declaration and react-live renders it. Turning noInline on would require
 * every block to call render() explicitly.
 */
export default function LiveExample({ code }: { code: string }) {
  return (
    <div className="rx-live">
      <LiveProvider code={code.trim()} scope={scope} theme={themes.vsDark}>
        <div className="rx-live__preview">
          <LivePreview />
        </div>
        <LiveError className="rx-live__error" />
        <div className="rx-live__editor">
          <span className="rx-live__label">Editable — try changing it</span>
          <LiveEditor />
        </div>
      </LiveProvider>
    </div>
  );
}
