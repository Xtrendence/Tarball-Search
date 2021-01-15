# Tarball Search

This is a React Native mobile application that works together with a Node.js API to recursively search through the content of ".tar.gz" files. It can be used for a wide variety of purposes, such as a text-only self-hosted Wikipedia, StackOverflow, or perhaps as a quick way to search through backed up messages or other forms of text data.

### How do I use it?

1. Download the source code, and use something like NSSM or a cron job to make sure the API is always running.
2. After running the API code for the first time, it should create a folder called "config", and a file called "pin.txt" inside it. Use an online (preferably offline) bcrypt hashing tool to hash a desired password, and copy-paste it into the "pin.txt" file. So for example, you could go to [this](https://bcrypt-generator.com/) website, and where it says "String to encrypt", you'd write a desired password; for this example I'll enter "test". The hash should look something like this:
 **$2y$12$lU0Pqm2Em6jbLS0b79ENtulmIB7uGEqtagyZ7wQNgHjWuK.PMxLua**. You can then copy-paste the generated hash into the "pin.txt" file so that its only contents are that string. 
 3. Install the app by downloading the APK file from the ["Releases"](https://github.com/Xtrendence/Tarball-Search/releases) section.
 4. Open the app, and tap on the settings icon on the top right.
 5. Enter the IP address of the server the API is hosted on (without the "http://"), the port the API is using (970 by default), and the plaintext version of the password you hashed in step 2.
 6. Tap on the "Save Configuration" button.
 7. Any ".tar.gz" files you place outside the API folder will now show up in the "Files" page of the app. Since the API recursively looks for files, you can put them in subdirectories and they'd still show up. 
 8. Select files you'd like to search the content of, go to the "Search" page, enter a search query, and tap on "Search X Files" (where X should be the number of files you selected).
 
The first 1,000 matches will be shown, but since the app starts lagging after that, the results are truncated.

To view previous searches, go to the "History" page. 

Active searches can be cancelled by tapping on the "Cancel" button after starting the search. If you leave the "Search" page, the button won't be there anymore. To cancel a search without the button, you'll have to delete the output file by holding down on it in the "History" page.
 

![Screenshot](https://i.imgur.com/0LBu95J.jpg)
![Screenshot](https://i.imgur.com/UnQjeBU.jpg)
![Screenshot](https://i.imgur.com/eQpqDit.jpg)
![Screenshot](https://i.imgur.com/O45GbAe.jpg)
