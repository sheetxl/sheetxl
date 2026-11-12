// The `prop-types` package ships without bundled type declarations and no
// `@types/prop-types` is installed. These modules use it only for runtime
// propType validation, so an untyped (`any`) module declaration is sufficient.
declare module 'prop-types';
