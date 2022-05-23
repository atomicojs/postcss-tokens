import { readFile } from "fs/promises";
import yaml from "js-yaml";
export const load = async (file: string) =>
    yaml.load(await readFile(file, "utf8"));
