/*
* Application settings file
*
* This file contains application settings that are used throughout the application
* These settings are loaded by the application and can be accessed by any module
* 
* Settings can be loaded from environment variables, other files, or hardcoded values
* 
* For more information on how to use this file, see the README.md file
* 
* Example:
* const { Config } = require("./config");
* const mySetting = Config.settings().someSetting;
* 
* You can organize settings into nested-objects for better structure, but you
* must export a single, top level object called `settings`
*/

const settings =  {
	"answer": 42,
	"baseUrl": process.env.BASE_URL || "",
	// "someNumSetting": process.env.SOME_SETTING || "all" // load environment variables - you should also implement validation
}

module.exports = settings;