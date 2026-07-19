import { createRouter, createWebHistory } from 'vue-router';
import Tasks from '../views/Tasks.vue';
import TaskDetail from '../views/TaskDetail.vue';
import Websites from '../views/Websites.vue';
import WebsiteDetail from '../views/WebsiteDetail.vue';
import Webpages from '../views/Webpages.vue';
import Responses from '../views/Responses.vue';
import WebpageDetail from '../views/WebpageDetail.vue';
import ResponseDetail from '../views/ResponseDetail.vue';
import RequestDetail from '../views/RequestDetail.vue';
import PayloadDetail from '../views/PayloadDetail.vue';
import Screenshots from '../views/Screenshots.vue';
import ScreenshotDetail from '../views/ScreenshotDetail.vue';
import Payloads from '../views/Payloads.vue';
import Remove from '../views/Remove.vue';
import Deobfuscator from '../views/Deobfuscator.vue';
import YaraRules from '../views/YaraRules.vue';
import UserAgents from '../views/UserAgents.vue';
import NotFound from '../views/NotFound.vue';

const routes = [
  { path: '/', component: Websites },
  { path: '/tasks', component: Tasks },
  //{ path: '/tasks/:id', component: TaskDetail, props: true },
  { path: '/websites', component: Websites },
  { path: '/websites/:id', component: WebsiteDetail, props: true },
  { path: '/webpages', component: Webpages },
  { path: '/webpages/:id', component: WebpageDetail, props: true },
  { path: '/responses', component: Responses },
  { path: '/responses/:id', component: ResponseDetail, props: true },
  { path: '/requests/:id', component: RequestDetail, props: true },
  { path: '/payloads', component: Payloads },
  { path: '/payloads/:id', component: PayloadDetail, props: true },
  { path: '/remove/:type/:id', component: Remove, props: true },
  { path: '/screenshots', component: Screenshots },
  { path: '/screenshots/:id', component: ScreenshotDetail, props: true },
  { path: '/yara-rules', component: YaraRules },
  { path: '/user-agents', component: UserAgents },
  { path: '/deobfuscator', component: Deobfuscator },
  { path: '/:pathMatch(.*)*', component: NotFound },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  },
});

export default router;
