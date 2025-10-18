import { Stagehand, ConstructorParams } from "@browserbasehq/Stagehand";
import dotenv from "dotenv";
dotenv.config();
export async function createStagehand() {
const config: ConstructorParams = {
env: "LOCAL",
apiKey: process.env.BROWSERBASE_API_KEY,
projectId: process.env.BROWSERBASE_PROJECT_ID,
verbose: 0,
};
const stagehand = new Stagehand(config);
await stagehand.init();
return stagehand;
}
