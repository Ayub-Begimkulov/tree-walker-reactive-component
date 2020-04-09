const state = {
  arr: ['a', 'b', 'c'],
  text: 'hello world'
};

const root = document.querySelector('#app');

const varRegex = '([a-zA-Z_$][0-9a-zA-Z_$]*)';
const spaceOrNewLine = '(?:\\s|\\n)*';
const mustacheRegex = new RegExp(
  `{{${spaceOrNewLine}${varRegex}${spaceOrNewLine}}}`
);
const forInRegex = new RegExp(
  `${varRegex}${spaceOrNewLine}in${spaceOrNewLine}${varRegex}`
);

const makeComponent = (
  el,
  { state: initialState = {}, listeners = {} } = {}
) => {
  let activeFunction = null;
  const deps = Object.create(null);

  const addDep = (key, value) =>
    (deps[key] || (deps[key] = new Set())).add(value);

  const state = new Proxy(initialState, {
    get(obj, key) {
      activeFunction && addDep(key, activeFunction);
      return obj[key];
    },
    set(obj, key, val) {
      const prev = obj[key];
      obj[key] = val;
      deps[key] && deps[key].forEach((patch) => patch(val, prev));
      return true;
    }
  });

  const WHAT_TO_SHOW = 5; // element or text
  const walker = document.createTreeWalker(el, WHAT_TO_SHOW);

  let current = root;

  while (current) {
    const node = current;

    if (node instanceof Text) {
      const text = node.textContent;
      if (hasContent(text)) {
        const key = text.match(mustacheRegex)[1];
        if (state[key]) {
          node.textContent = state[key];
          addDep(key, (newVal) => (node.textContent = newVal));
        }
      }
    } else {
      Array.from(node.attributes).forEach(({ name, value }) => {
        if (name.indexOf('data-on-') === 0) {
          const eventName = name.replace('data-on-', '');
          const handlerKey = value.trim();
          if (typeof listeners[handlerKey] === 'function') {
            node.addEventListener(eventName, (e) =>
              listeners[handlerKey](state, e)
            );
          }
        } else if (name === 'data-if') {
          const condition = new Function('state', 'return ' + value);

          const comment = document.createComment('');
          const parent = node.parentNode;

          activeFunction = () => {
            if (condition(state)) {
              if (node.parentNode !== parent) {
                replaceNode(comment, node);
              }
            } else if (node.parentNode === parent) {
              replaceNode(node, comment);
            }
          };

          if (!condition(state)) {
            replaceNode(node, comment);
          }

          activeFunction = null;
        } else if (name === 'data-for') {
          const forInMatch = value.match(forInRegex);
          if (forInMatch) {
            const [_, alias, arrayKey] = forInMatch;
            console.log(state[arrayKey]);
          }
        } else {
          const mustacheMatch = value.match(mustacheRegex);
          if (mustacheMatch) {
            const key = mustacheMatch[1];
            if (state[key]) {
              addDep(key, (newVal) => node.setAttribute(name, newVal));
              current.setAttribute(name, state[key]);
            }
          }
        }
      });
    }
    current = walker.nextNode();
  }
};

const replaceNode = (oldNode, newNode) => {
  const parent = oldNode.parentNode;
  parent.insertBefore(newNode, oldNode);
  parent.removeChild(oldNode);
};

const hasContent = (text) =>
  text.replace(new RegExp(spaceOrNewLine, 'g'), '').length > 0;

makeComponent(root, {
  state,
  listeners: {
    onInput: (state, e) => {
      console.log(state, e);
      state.text = e.target.value;
    }
  }
});
