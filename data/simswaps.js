const SIM_SWAPS = {
  // Format : 'msisdn': timestamp du dernier swap
  'msisdn-0900000002': new Date(Date.now() - 2 * 3600 * 1000).toISOString(),  // il y a 2h
  'msisdn-0900000004': new Date(Date.now() - 5 * 3600 * 1000).toISOString(),  // il y a 5h
};

module.exports = SIM_SWAPS;
