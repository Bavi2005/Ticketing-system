// The supplied operations catalogue. Existing BR codes retain their database IDs.
const sites = [
  ["PRPC", "SOUTHERN"], ["TOWER 1", "CENTRAL"], ["TOWER 2", "CENTRAL"],
  ["TOWER 3", "CENTRAL"], ["MPS", "CENTRAL"], ["INSTEP", "EC"],
  ["PCOGD", "EC"], ["PPTSB", "EC"], ["PCEPE", "EC"], ["PCLDPE", "EC"],
  ["PCASB", "EC"], ["MTB", "EC"], ["SHAH ALAM RO", "CENTRAL"],
  ["GURUN RO", "NORTHERN"], ["SETIAWAN RO", "NORTHERN"],
  ["SEGAMAT RO", "SOUTHERN"], ["SEGAMAT PGCC", "SOUTHERN"],
  ["SEGAMAT COMP", "SOUTHERN"], ["KTN RO", "EC"], ["KTN COMP", "EC"],
  ["SEREMBAN RO", "CENTRAL"], ["KLUANG COMP", "SOUTHERN"],
  ["RGTP", "SOUTHERN"], ["RGTSU", "CENTRAL"], ["PGRO", "SOUTHERN"], ["MRCSB", "SOUTHERN"],
].map(([name, region], i) => ({ name, region, code: `BR${i + 1}` }));
const regions = ["CENTRAL", "NORTHERN", "SOUTHERN", "EC"];
module.exports = { sites, regions };
