<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## DocuSift architecture
- Validation rules, status routing, change detection and accuracy math live in `src/lib/doc-schema.ts` as pure functions (tested in `src/test/doc-rules.test.ts`); never let the AI model decide pass/fail.
- All writes go through server functions in `src/lib/docs.functions.ts` using the admin client; tables are anon read-only via RLS (public no-login demo).
- Images live in the private `uploads` bucket and are served by `/api/public/images/$path` (public buckets are blocked in this workspace).
- Sample SVGs in `public/samples` are generated from `src/lib/samples.ts` via `bun scripts/gen-samples.ts`; seed rows come from the `reset_demo()` SQL function.
