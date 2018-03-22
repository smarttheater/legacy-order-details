import 'es6-promise/auto';

import Vue from 'vue';
import App from './App.vue';

window.vueCheckinApp = new Vue({
    el: '#vueApp',
    render: h => h(App),
});

window.addEventListener('unload', () => {
    window.vueCheckinApp.$destroy();
    window.vueCheckinApp = null;
});
