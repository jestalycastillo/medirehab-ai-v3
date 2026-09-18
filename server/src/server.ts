import "dotenv/config";
import app from "./app";
import { startAdherenceAlertWorker } from "./services/adherence-alert.service";

const PORT: number = Number(process.env.EXPRESS_SERVER_PORT) || 5000;

app.listen(PORT, ():void => {
    console.log(`Express listening on port: ${PORT}.`);
    startAdherenceAlertWorker();
});
