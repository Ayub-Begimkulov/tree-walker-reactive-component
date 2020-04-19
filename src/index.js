import { makeComponent } from './lib';

const root = document.querySelector('#app');

const state = {
  arr: [1, 2, 3],
  text: 'hello world'
};

makeComponent(root, {
  state,
  listeners: {
    onInput: (state, e) => {
      console.log(e.target.value);
      state.text = e.target.value;
    },
    onClick: ({ text }) => console.log(text),
    updateArray: state => {
      state.arr = Array(Math.round(Math.random() * 10))
        .fill()
        .map(() => Math.round(Math.random() * 100));
    }
  }
});
