const CLIENT_ID = '175190763119-gek4639gt61jctuug6r9hpk06fuk3btr.apps.googleusercontent.com';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';


feather.replace();
const $authorizeButton = $('#authorize-button');
const $signoutButton = $('#signout-button');

function handleClientLoad() {
	gapi.load('client:auth2', initClient);
}

function updateSigninStauts(isSignedIn) {
	if (isSignedIn) {
		$authorizeButton.hide();
		$signoutButton.show();
	} else {
		$authorizeButton.show();
		$signoutButton.hide();
	}
}

function handleAuthClick() {
	gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
	gapi.auth2.getAuthInstance().signOut();
}

function initClient() {
	gapi.client.init({
		discoveryDocs: DISCOVERY_DOCS,
		clientId: CLIENT_ID,
		scope: SCOPES,
	}).then(() => {
		gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
		updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
		$authorizeButton.on('click', handleAuthClick);
		$signoutButton.on('click', handleSignoutClick);
	});
}