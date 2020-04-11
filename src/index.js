import { makeComponent } from './lib';

const root = document.querySelector('#app');

const state = {
  arr: ['a', 'b', 'c'],
  text: 'hello world'
};

makeComponent(root, {
  state,
  listeners: {
    onInput: (state, e) => {
      console.log(e.target.value);
      state.text = e.target.value;
    },
    onClick: ({ text }) => console.log(text)
  }
});
