import { test, expect } from '@playwright/test';
import * as fs from 'fs';
const testFilePath = 'pr-tests/assets/quijote.txt';

test('Connect two peers and send a large file from Caller to Callee', async ({ browser }) => {
    const callerContext = await browser.newContext();
    const callerPage = await callerContext.newPage();

    const calleeContext = await browser.newContext();
    const calleePage = await calleeContext.newPage();

    // Navigate both peers to the app
    callerPage.on('console', msg => console.log('P1:', msg.text()));
    calleePage.on('console', msg => console.log('P2:', msg.text()));
    await callerPage.goto('/');
    await calleePage.goto('/');
    // Wait for both pages to load
    await expect(callerPage.locator('#set-name-btn')).toBeVisible();
    await expect(calleePage.locator('#set-name-btn')).toBeVisible();
    await callerPage.waitForTimeout(2000);

    const callerSetNameBtn = callerPage.locator('#set-name-btn');
    const calleeSetNameBtn = calleePage.locator('#set-name-btn');

    // Ensure Set Name buttons are enabled
    await expect(callerSetNameBtn).toBeEnabled();
    await expect(calleeSetNameBtn).toBeEnabled();
    await callerSetNameBtn.click();
    await calleeSetNameBtn.click();

    //wait 2 s
    await callerPage.waitForTimeout(2000);

    // Get Caller Name:
    const callerNameInput = callerPage.locator('#display-name-input');
    await expect(callerNameInput).toBeVisible();
    await expect(callerNameInput).not.toBeEmpty();
    const callerName = await callerNameInput.inputValue();

    // Get Callee Name:
    const calleeNameInput = calleePage.locator('#display-name-input');
    await expect(calleeNameInput).toBeVisible();
    await expect(calleeNameInput).not.toBeEmpty();
    const calleeName = await calleeNameInput.inputValue();

    // Caller initiates call to Callee
    const remotePeerInput = callerPage.locator('#remote-id');
    await remotePeerInput.fill(calleeName);
    const callButton = callerPage.locator('#connect-btn');
    await expect(callButton).toBeEnabled();

    await callButton.click();



    // Wait for channel to be established
    const callerStatus = callerPage.locator('#status');
    const calleeStatus = calleePage.locator('#status');
    await expect(callerStatus).toContainText('Data Channel is open', { timeout: 20000 });
    await expect(calleeStatus).toContainText('Data Channel is open', { timeout: 20000 });

    // Caller sends a file to Callee
    const fileInput = callerPage.locator('#file-input');

    await fileInput.setInputFiles(testFilePath);
    const sendFileButton = callerPage.locator('#send-file-btn');
    await expect(sendFileButton).toBeEnabled();
    await sendFileButton.click();

    // Verify Callee received the file
    const calleeFilesContainer = calleePage.locator('#messages');
    const lastReceivedFile = calleeFilesContainer.locator('div').last();
    await expect(lastReceivedFile).toContainText('Download', { timeout: 10000 });
    // Verify the file content by downloading and checking byte-to-byte
    const downloadLink = lastReceivedFile.locator('a');
    const downloadUrl = (await downloadLink.getAttribute('href'))!;
    const downloadedBuffer = await calleePage.evaluate(async (url) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
    }, downloadUrl);

    const originalBuffer = fs.readFileSync(testFilePath);
    const receivedBuffer = Buffer.from(downloadedBuffer);

    expect(receivedBuffer.length).toBe(originalBuffer.length);
    expect(receivedBuffer.equals(originalBuffer)).toBe(true);

});
