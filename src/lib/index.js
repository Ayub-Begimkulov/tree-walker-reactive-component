import { textHasContent, replaceNode, addListener } from './utils';

const varRegex = '([a-zA-Z_$][0-9a-zA-Z_$]*)';
const spaceOrNewLine = '(?:\\s|\\n)*';
const mustacheRegex = new RegExp(
  `{{${spaceOrNewLine}${varRegex}${spaceOrNewLine}}}`
);
const forInRegex = new RegExp(
  `${varRegex}${spaceOrNewLine}in${spaceOrNewLine}${varRegex}`
);

export const makeComponent = (
  el,
  { state: initialState = {}, listeners = {} } = {}
) => {
  let updateFunction = null;
  const deps = Object.create(null);

  const addDep = (key, value) =>
    (deps[key] || (deps[key] = new Set())).add(value);

  const state = new Proxy(initialState, {
    get(obj, key) {
      updateFunction && addDep(key, updateFunction);
      return obj[key];
    },
    set(obj, key, val) {
      const prev = obj[key];
      obj[key] = val;
      deps[key] && deps[key].forEach(patch => patch(val, prev));
      return true;
    }
  });

  const init = () => {
    const WHAT_TO_SHOW = 5; // element or text
    const walker = document.createTreeWalker(el, WHAT_TO_SHOW);

    let current = el;

    while (current) {
      current instanceof Text ? handleText(current) : handleElement(current);
      current = walker.nextNode();
    }
  };

  const handleText = node => {
    const text = node.textContent;
    if (textHasContent(text)) {
      const key = text.match(mustacheRegex)[1];
      if (state[key]) {
        node.textContent = state[key];
        addDep(key, newVal => (node.textContent = newVal));
      }
    }
  };

  const handleElement = node => {
    const addListenerFns = [];
    let condition = null;

    Array.from(node.attributes).forEach(({ name, value }) => {
      switch (name.substring(0, 8)) {
        case 'data-on-':
          const eventName = name.replace('data-on-', '');
          const handlerKey = value.trim();
          if (typeof listeners[handlerKey] === 'function') {
            addListenerFns.push(() =>
              addListener(node, eventName, e => listeners[handlerKey](state, e))
            );
          }
          break;
        case 'data-if':
          condition = new Function('state', 'return ' + value);
          break;
        case 'data-for':
          const placeholder = node.cloneNode(true);
          console.log(placeholder);
          const forInMatch = value.match(forInRegex);
          if (forInMatch) {
            const [_, alias, arrayKey] = forInMatch;
            console.log(state[arrayKey]);
          }
          break;
        default:
          const mustacheMatch = value.match(mustacheRegex);
          if (mustacheMatch) {
            const key = mustacheMatch[1];
            if (state[key]) {
              addDep(key, newVal => node.setAttribute(name, newVal));
              node.setAttribute(name, state[key]);
            }
          }
      }
    });

    let removeListenerFunctions;

    if (condition) {
      const comment = document.createComment('');
      const parent = node.parentNode;

      updateFunction = () => {
        if (condition(state)) {
          if (node.parentNode !== parent) {
            replaceNode(comment, node);
            removeListenerFunctions = addListenerFns.map(fn => fn());
          }
        } else if (node.parentNode === parent) {
          removeListenerFunctions &&
            removeListenerFunctions.length &&
            removeListenerFunctions.forEach(fn => fn());
          replaceNode(node, comment);
        }
      };

      if (!condition(state)) {
        replaceNode(node, comment);
      } else {
        removeListenerFunctions = addListenerFns.map(fn => fn());
      }

      updateFunction = null;
    } else {
      removeListenerFunctions = addListenerFns.map(fn => fn());
    }
  };

  init();
};
