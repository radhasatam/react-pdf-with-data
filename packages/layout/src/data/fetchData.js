/* eslint-disable no-param-reassign */

import getUrl from './getUrl';

/**
 * Fetches data from a url prop and appends data to node
 *
 * @param {Object} node
 */
const fetchData = async node => {
  const url = getUrl(node);

  if (!url) {
    console.warn(false, 'Data should receive a "url" prop');
    return;
  }

  try {
    const res = await fetch(url);
    if (!res) {
      throw new Error(`Fetch request for ${url} returned nothing`);
    }
    node.data = await res.json();
  } catch (e) {
    node.data = [];
    console.warn(e.message);
  }
};

export default fetchData;
