import * as readline from "readline";

export async function promptTan(challengeText: string): Promise<string> {
    if (challengeText) {
        console.info(challengeText);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const tan = await new Promise<string>((resolve) => {
        rl.question("Enter TAN: ", (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
    if (!tan) {
        throw new Error("TAN is required to complete the operation.");
    }
    return tan;
}
