import * as R from 'ramda';
import * as P from '@react-pdf/primitives';
import createInstance from '../node/createInstance';
import resolveTextLayout from './resolveTextLayout';
import resolveInheritance from './resolveInheritance';
import { resolvePageDimensions } from './resolveDimensions';

import fetchDataFromProps from '../data/fetchData';

const isData = R.propEq('type', P.Data);
const isDynamic = R.hasPath(['props', 'renderData']);
const isText = R.propEq('type', P.Text);
const assingChildren = R.assoc('children');

// TODO: Reuse from resolvePagination
const compose = (...fns) => (value, ...args) => {
  let result = value;
  const reversedFns = R.reverse(fns);

  for (let i = 0; i < reversedFns.length; i += 1) {
    const fn = reversedFns[i];
    result = fn(result, ...args);
  }

  return result;
};

const relayoutPage = compose(
  resolveTextLayout,
  resolveInheritance,
  resolvePageDimensions,
);

const shouldResolveDynamicNodes = node => {
  const children = node.children || [];
  return isDynamic(node) || children.some(shouldResolveDynamicNodes);
};

const resolveDynamicNodes = (props, node) => {
  const isNodeDynamic = isDynamic(node);

  // Call render prop on dynamic nodes and append result to children
  const resolveChildren = (children = []) => {
    if (isNodeDynamic) {
      const res = node.props.renderData(props);
      return [createInstance(res)].filter(Boolean);
    }

    return children.map(c => resolveDynamicNodes(props, c));
  };

  // We reset dynamic text box so it can be computed again later on
  const resolveBox = box => {
    return isNodeDynamic && isText(node) ? { ...box, height: 0 } : box;
  };

  return R.evolve(
    {
      box: resolveBox,
      children: resolveChildren,
      lines: prev => (isNodeDynamic ? null : prev),
    },
    node,
  );
};

const resolveDataProp = fontStore => page => {
  const p = { ...page };
  for (let i = 0; i < page.children.length; i += 1) {
    const node = page.children[i];
    if (node.data && shouldResolveDynamicNodes(node)) {
      node.type = 'VIEW';
      const resolvedNode = resolveDynamicNodes({ data: node.data ?? [] }, node);
      relayoutPage(resolvedNode, fontStore);
      p.children[i] = resolvedNode;
    }
  }
  // return relayoutPage(page, fontStore);
  const relayout = relayoutPage(p, fontStore);
  return relayout;
};

/**
 * Get all asset promises that need to be resolved
 *
 * @param {Object} root node
 * @returns {Array} asset promises
 */
const fetchData = node => {
  const promises = [];
  const listToExplore = node.children?.slice(0) || [];

  while (listToExplore.length > 0) {
    const n = listToExplore.shift();
    if (isData(n)) {
      promises.push(fetchDataFromProps(n));
    }

    if (n.children) {
      n.children.forEach(childNode => {
        listToExplore.push(childNode);
      });
    }
  }

  return promises;
};

/**
 * Fetch data from API url
 * Layout process will not be resumed until promise resolves.
 *
 * @param {Object} root node
 * @returns {Object} root node
 */
const resolveData = async (doc, fontStore) => {
  const promises = fetchData(doc);
  await Promise.all(promises);

  let pages = [];
  for (let i = 0; i < doc.children.length; i += 1) {
    const page = doc.children[i];
    pages = pages.concat(page);
  }

  pages = pages.map(resolveDataProp(fontStore));

  const toReturn = assingChildren(pages, doc);
  return toReturn;
};

export default resolveData;
