# Follow Check contributor instructions

- Treat the GitHub `main` branch as the central source of truth for this project.
- Before editing, fetch GitHub and update the local branch with a fast-forward pull when the working tree is clean.
- Preserve unrelated or uncommitted user files and changes.
- After requested changes are implemented and verified, commit only the files related to the task and push the commit to `origin/main` unless the user explicitly asks not to publish it.
- Never commit secrets, `.env` files, customer data, or generated dependency/build directories.
- If pulling or pushing would overwrite work, create a conflict, or require choosing between versions, stop and explain the conflict instead of forcing the operation.
