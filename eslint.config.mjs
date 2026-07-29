import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import { globalIgnores } from "eslint/config";

const eslintConfig = [...nextCoreWebVitals, ...nextTypeScript];

const config = [globalIgnores(["backend/**"]), ...eslintConfig];

export default config;
