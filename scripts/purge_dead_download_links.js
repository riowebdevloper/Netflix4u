const fs = require('fs');
const path = require('path');

const DETAILS_DIR = path.join(__dirname, '../data/details');

function sanitizeDetailFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    // Fast check: only parse JSON if it actually contains links or potentially dead patterns
    if (!raw.includes('"links"') && !raw.includes('vcloud') && !raw.includes('nexdrive')) {
      return { modified: false };
    }

    const data = JSON.parse(raw);
    let changed = false;

    if (Array.isArray(data.links) && data.links.length > 0) {
      const originalCount = data.links.length;
      const seenUrls = new Set();
      
      const filtered = data.links.filter(link => {
        if (!link || !link.url) return false;
        const u = link.url.trim();

        // 1. Purge empty vcloud parameter
        if (u.endsWith('?vcloud=') || u.endsWith('?vcloud=https://vcloud.fit/') || u.endsWith('?vcloud=https://vcloud.fit')) {
          return false;
        }

        // 2. Purge dead fake nexdrive download URLs
        if (u.includes('nexdrive.love/download/')) {
          return false;
        }

        // 3. Purge invalid URLs
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
          return false;
        }

        // 4. Deduplicate
        if (seenUrls.has(u)) {
          return false;
        }
        seenUrls.add(u);

        return true;
      });

      if (filtered.length !== originalCount) {
        data.links = filtered;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
      return { modified: true, id: data.id || path.basename(filePath) };
    }
  } catch (err) {}
  return { modified: false };
}

async function run() {
  console.log('🔍 Scanning data/details for dead, empty, and duplicate download links...');
  const files = fs.readdirSync(DETAILS_DIR).filter(f => f.endsWith('.json'));
  let modifiedCount = 0;
  const start = Date.now();

  for (let i = 0; i < files.length; i++) {
    const res = sanitizeDetailFile(path.join(DETAILS_DIR, files[i]));
    if (res.modified) {
      modifiedCount++;
    }
    if ((i + 1) % 5000 === 0) {
      console.log(`Processed ${i + 1}/${files.length} files... (${modifiedCount} updated)`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Sanitization complete in ${elapsed}s! ${modifiedCount} files updated out of ${files.length} total.`);
}

run();
