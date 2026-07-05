const DATA_URLS = [
  "https://raw.githubusercontent.com/hs997/fund-flow-public/main/data/latest.json",
  "https://api.github.com/repos/hs997/fund-flow-public/contents/data/latest.json?ref=main",
  "https://hs997.github.io/fund-flow-public/data/latest.json"
];
const DEFAULT_REFRESH_SECONDS = 60;

module.exports = {
  DATA_URLS,
  DEFAULT_REFRESH_SECONDS
};
