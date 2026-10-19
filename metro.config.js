const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const avatarMap = {
  'jinwoo.jpg': 'C:/Users/HP/.gemini/antigravity-ide/brain/87b29d3b-410f-4250-8c00-0c22642f24b1/avatar_jinwoo_1786783657459.jpg',
  'podium_stage_bg.jpg': 'C:/Users/HP/.gemini/antigravity-ide/brain/8a57d572-b544-4182-a6bc-bfb3de320395/podium_stage_bg_1791639149287.jpg',
};

const destDir = path.join(__dirname, 'assets', 'images');

// Clean up unwanted legacy anime images
const unwantedImages = ['naruto.jpg', 'luffy.jpg', 'gojo.jpg', 'itachi.jpg', 'goku.jpg'];
for (const unwanted of unwantedImages) {
  const filePath = path.join(destDir, unwanted);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[Metro Config] Removed unwanted avatar ${unwanted}`);
    } catch {}
  }
}

try {
  for (const [filename, srcPath] of Object.entries(avatarMap)) {
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(destDir, filename);
      fs.copyFileSync(srcPath, destPath);
      console.log(`[Metro Config] Copied ${filename} to assets/images/`);
    }
  }
} catch (err) {
  console.error('[Metro Config] Error copying avatars:', err);
}

const config = getDefaultConfig(__dirname);
module.exports = config;
