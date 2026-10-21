# Maintaining the translated READMEs

The repository README and its 16 translations share one template, image set, download table, and language selector. The selector describes README languages, not a promise about the app's interface languages.

Edit the localized text in `scripts/readme-locales.json`. English is the source copy. When changing product information, update the corresponding text in every locale. Native-speaker review is encouraged for wording and terminology.

The shared layout and links live in `scripts/build-readmes.mjs`. Keep the TestFlight entry directed to the Manatan Discord community. Do not add a direct beta invitation without the maintainer's approval.

Regenerate and validate from the repository root:

```sh
node scripts/build-readmes.mjs
node scripts/test-readmes.mjs
```

The test checks generated output, complete language navigation, local images, matching external destinations, Web platform coverage, App Store and TestFlight entries, and Arabic right-to-left markup. It does not replace a linguistic review or a live link check.

The English README is `README.md`; translations are `docs/readme/README.<locale>.md`. Images are shared rather than duplicated. The linked product guides are currently in English, which each README states explicitly.
