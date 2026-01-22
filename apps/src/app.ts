import { createApp } from "nativescript-vue";
import { Video } from "@nstudio/nativescript-exoplayer";
import Home from "./pages/Home.vue";

const app = createApp(Home);

// Register VideoPlayer component
app.registerElement("VideoPlayer", () => Video);

app.start();
