import { test, expect } from '@playwright/test';

test('Connect two peers and exchange messages', async ({ browser }) => {
    const peerOneContext = await browser.newContext();
    const peerOnePage = await peerOneContext.newPage();

    const peerTwoContext = await browser.newContext();
    const peerTwoPage = await peerTwoContext.newPage();

    // Navigate both peers to the app
    peerOnePage.on('console', msg => console.log('P1:', msg.text()));
    peerTwoPage.on('console', msg => console.log('P2:', msg.text()));
    peerOnePage.on('pageerror', error => console.log('P1 Page Error:', error.message));
    peerTwoPage.on('pageerror', error => console.log('P2 Page Error:', error.message));
    await peerOnePage.goto('/');
    await peerTwoPage.goto('/');
    // Wait for both pages to load
    await expect(peerOnePage.locator('#set-name-btn')).toBeVisible();
    await expect(peerTwoPage.locator('#set-name-btn')).toBeVisible();
    await peerOnePage.waitForTimeout(2000);
    // Add WebRTC debugging
    await peerOnePage.evaluate(() => {
        window.addEventListener('data-channel-state', (e) => {
            // @ts-ignore
            console.log('Peer One - Channel state:', e.detail);
        });
    });

    await peerTwoPage.evaluate(() => {
        window.addEventListener('data-channel-state', (e) => {
            // @ts-ignore
            console.log('Peer Two - Channel state:', e.detail);
        });
    });

    const peerOneSetNameBtn = peerOnePage.locator('#set-name-btn');
    const peerTwoSetNameBtn = peerTwoPage.locator('#set-name-btn');

    // Ensure Set Name buttons are enabled
    await expect(peerOneSetNameBtn).toBeEnabled();
    await expect(peerTwoSetNameBtn).toBeEnabled();
    

    //wait 2 s
    await peerOnePage.waitForTimeout(2000);

    // Get Peer One Name:
    const peerOneNameInput = peerOnePage.locator('#display-name-input');
    await expect(peerOneNameInput).toBeVisible();
    await expect(peerOneNameInput).not.toBeEmpty();
    const peerOneName = await peerOneNameInput.inputValue();

    // Get Peer Two Name:
    const peerTwoNameInput = peerTwoPage.locator('#display-name-input');
    await expect(peerTwoNameInput).toBeVisible();
    await expect(peerTwoNameInput).not.toBeEmpty();
    const peerTwoName = await peerTwoNameInput.inputValue();

    // Peer One initiates call to Peer Two
    const remotePeerInput = peerOnePage.locator('#remote-id');
    await remotePeerInput.fill(peerTwoName);
    const callButton = peerOnePage.locator('#connect-btn');
    await expect(callButton).toBeEnabled();

    await callButton.click();



    // Wait for channel to be established
    const peerOneStatus = peerOnePage.locator('#status');
    const peerTwoStatus = peerTwoPage.locator('#status');
    await expect(peerOneStatus).toContainText('Data Channel is open', { timeout: 20000 });
    await expect(peerTwoStatus).toContainText('Data Channel is open', { timeout: 20000 });

    // Peer One sends message to Peer Two
    const messageInputOne = peerOnePage.locator('#message-input');
    const sendButtonOne = peerOnePage.locator('#send-btn');
    const testMessageOne = 'Hello from Peer One!';
    await messageInputOne.fill(testMessageOne);
    await expect(sendButtonOne).toBeEnabled();
    await sendButtonOne.click();

    // Verify message appears on the sender side
    const peerOneMessagesContainer = peerOnePage.locator('#messages');
    //expect the last message to be the sent message and to have a class 'my-message'
    const lastMessageOne = peerOneMessagesContainer.locator('div').last();
    await expect(lastMessageOne).toHaveText(testMessageOne);
    await expect(lastMessageOne).toHaveClass(/my-message/);

    // Verify message appears on Peer Two side
    const peerTwoMessagesContainer = peerTwoPage.locator('#messages');
    const lastMessageTwo = peerTwoMessagesContainer.locator('div').last();
    await expect(lastMessageTwo).toContainText(testMessageOne);
    await expect(lastMessageTwo).toHaveClass(/peer-message/);
});