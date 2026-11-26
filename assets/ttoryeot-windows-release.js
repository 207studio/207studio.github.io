(async function () {
  const installer = document.querySelector('[data-tt-os="windows"]');
  if (!installer) return;

  const repo = "207studio-oss/ttoryeot-desktop";
  const releasesURL = `https://github.com/${repo}/releases/download`;
  let releases;
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
      cache: "no-cache",
    });
    if (!response.ok) return;
    releases = await response.json();
  } catch {
    return;
  }
  if (!Array.isArray(releases)) return;

  let latest;
  for (const release of releases) {
    if (!release || release.draft !== false || release.prerelease !== false) continue;
    const tag = release.tag_name;
    const published = Date.parse(release.published_at);
    if (!/^v\d+\.\d+\.\d+$/.test(tag) || !Number.isFinite(published)) continue;
    if (!Array.isArray(release.assets) || (latest && latest.published >= published)) continue;

    const filename = `ttoryeot-desktop-${tag.slice(1)}-windows-x64-setup.exe`;
    const download = `${releasesURL}/${tag}/`;
    const uploadedAsset = (name) => release.assets.find((asset) =>
      asset && asset.name === name && asset.state === "uploaded"
      && asset.browser_download_url === download + name,
    );
    if (uploadedAsset(filename)) {
      latest = { tag, published, url: download + filename, sums: uploadedAsset("SHA256SUMS") };
    }
  }
  if (!latest) return;

  const suffix = ` · ${latest.tag}`;
  const title = installer.querySelector("b");
  title.textContent += suffix;
  const buttonLabel = installer.getAttribute("data-tt-button") + suffix;
  installer.setAttribute("data-tt-button", buttonLabel);
  installer.href = latest.url;

  if (installer.getAttribute("aria-current") === "true") {
    document.querySelector("[data-tt-main]").href = latest.url;
    document.querySelector("[data-tt-label]").textContent = buttonLabel;
  }
  if (latest.sums) {
    const sums = document.querySelector("[data-tt-windows-sums]");
    sums.querySelector("a").href = latest.sums.browser_download_url;
    sums.hidden = false;
  }
})();
