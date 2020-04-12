export const replaceNode = (oldNode, newNode) => {
  const parent = oldNode.parentNode;
  parent.insertBefore(newNode, oldNode);
  parent.removeChild(oldNode);
};

export const textHasContent = text => text.replace(/(?:\s|\n)/g, '').length > 0;

export const addListener = (el, event, listener) => {
  el.addEventListener(event, listener);
  return () => el.removeEventListener(event, listener);
};

export const setAttribute = (el, attr, val) => {
  el.setAttribute(attr, val);
  return newVal => el.setAttribute(attr, newVal);
};

export const isDef = v => v !== undefined;
