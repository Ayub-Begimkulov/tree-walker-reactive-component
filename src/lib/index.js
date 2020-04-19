import { zip } from 'lodash-es';
import {
  isDefined,
  textHasContent,
  replaceNode,
  addListener,
  setAttribute
} from './utils';

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

  const addDep = (key, value) => {
    (deps[key] || (deps[key] = new Set())).add(value);

    return () => deps[key].delete(value);
  };

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

  const WHAT_TO_SHOW = 5; // element or text
  const walker = document.createTreeWalker(el, WHAT_TO_SHOW);

  const init = () => {
    let current = el;

    while (current) {
      current instanceof Text ? handleText(current) : handleElement(current);
      current = walker.nextNode();
    }
  };

  const next = () => walker.nextNode();

  const handleText = node => {
    const text = node.textContent;
    if (textHasContent(text)) {
      const match = text.match(mustacheRegex);
      const key = match && match[1];
      if (key && state[key]) {
        node.textContent = state[key];
        addDep(key, newVal => (node.textContent = newVal));
      }
    }
  };

  const makeListenerWithState = fn => e => fn(state, e);

  const handleElement = node => {
    let condition;
    let forLoop;
    const dynamicAttrs = [];
    const events = [];

    Array.from(node.attributes).forEach(({ name, value }) => {
      switch (name.substring(0, 8)) {
        case 'data-on-':
          const eventName = name.replace('data-on-', '');
          const handlerKey = value.trim();
          if (typeof listeners[handlerKey] === 'function') {
            events.push({
              event: eventName,
              listener: makeListenerWithState(listeners[handlerKey])
            });
          }
          break;
        case 'data-if':
          condition = new Function('state', 'return ' + value);
          break;
        case 'data-for':
          const forInMatch = value.match(forInRegex);
          if (forInMatch) {
            const [_, alias, arrayKey] = forInMatch;
            forLoop = {
              arrayKey,
              alias
            };
          }
          break;
        default:
          const mustacheMatch = value.match(mustacheRegex);
          const key = mustacheMatch && mustacheMatch[1];
          if (key) {
            dynamicAttrs.push({ name, key });
          }
      }
    });

    /**
     * 1) Attrs - done
     * 2) New Items - done
     * 3) Text - done
     * 4) Condition
     * 5) Nested loop
     */

    if (forLoop) {
      const comment = document.createComment('');
      node.parentNode.insertBefore(comment, node);

      const placeholder = node.cloneNode(true);

      next();
      node.parentNode.removeChild(node);

      const { arrayKey, alias } = forLoop;
      const arrToLoop = state[arrayKey];

      const patchFunctions = [];

      addDep(arrayKey, (newVal, oldVal) => {
        console.log(oldVal, '\n', newVal);
        const zipArray = zip(newVal, oldVal);

        zipArray.forEach(([newVal, oldVal], index) => {
          if (isDefined(oldVal) && isDefined(newVal)) {
            const newState = { ...state, $index: index, [alias]: newVal };

            patchFunctions[index] &&
              patchFunctions[index].newVal.forEach(fn => fn(newState));
          }
          if (isDefined(newVal) && !isDefined(oldVal)) {
            initEl(newVal, index);
          }
          if (!isDefined(newVal) && isDefined(oldVal)) {
            patchFunctions[index] &&
              patchFunctions[index].remove.forEach(fn => fn());
          }
        });
      });

      const initEl = (val, index) => {
        const updates = {
          newVal: [],
          remove: []
        };
        const scopeState = { ...state, [alias]: val, $index: index };
        const newNode = placeholder.cloneNode(true);

        const addListenerFns = events.map(({ event, listener }) => () =>
          addListener(newNode, event, listener)
        );

        dynamicAttrs.forEach(({ name, key }) => {
          if (scopeState[key]) {
            const updateAttr = setAttribute(newNode, name, scopeState[key]);

            updates.newVal.push(state => {
              updateAttr(state[key]);
            });
          }
        });

        const match = newNode.textContent.match(mustacheRegex);

        if (match) {
          const key = match[1];
          if (key && scopeState[key]) {
            newNode.textContent = scopeState[key];
            if (key !== alias) {
              const remove = addDep(
                key,
                newVal => (newNode.textContent = newVal)
              );

              updates.remove.push(remove);
            }
          }
        }

        let removeListenerFunctions;
        comment.parentNode.insertBefore(newNode, comment);
        updates.remove.push(() => newNode.parentNode.removeChild(newNode));
        removeListenerFunctions = addListenerFns.map(fn => fn());
        patchFunctions[index] = updates;
      };

      arrToLoop.forEach(initEl);
    } else {
      const addListenerFns = events.map(({ event, listener }) => () =>
        addListener(node, event, listener)
      );

      dynamicAttrs.forEach(({ name, key }) => {
        state[key] && addDep(key, setAttribute(node, name, state[key]));
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
    }
  };

  init();
};
