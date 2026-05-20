import { readFileSync, writeFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const cargo = readFileSync('./src-tauri/Cargo.toml', 'utf-8');
writeFileSync('./src-tauri/Cargo.toml', cargo.replace(/^version = ".*"/m, `version = "${version}"`));
console.log(`Synced src-tauri/Cargo.toml to ${version}`);
