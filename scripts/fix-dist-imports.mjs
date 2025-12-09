import fs from 'fs';
import path from 'path';

const targetDir = path.resolve('dist-tests');

const needsJsExtension = (specifier) => {
  return (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !specifier.endsWith('.js') &&
    !specifier.endsWith('.json');
};

const patchFile = (filePath) => {
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = original.replace(/from\s+(['"])(\.\.\/[^'";]+|\.\/[^'";]+)\1/g, (full, quote, specifier) => {
    if (!needsJsExtension(specifier)) return full;
    return `from ${quote}${specifier}.js${quote}`;
  });

  if (original !== updated) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
};

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      patchFile(fullPath);
    }
  }
};

if (fs.existsSync(targetDir)) {
  walk(targetDir);
}
