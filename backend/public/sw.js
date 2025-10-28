self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: 'icons/icon-192x192.png', // You'll need to create an icon for your app
    };
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});