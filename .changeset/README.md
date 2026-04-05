# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

## Adding a changeset

When you make a change that should be included in the next release, run:

```bash
bunx changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the semver bump type (patch/minor/major)
3. Write a summary of the change

The changeset file is committed alongside your code in the PR.
