import { setGlobalOptions } from "firebase-functions/v2";
import { REGION } from "./core/band.js";

setGlobalOptions({ region: REGION });
