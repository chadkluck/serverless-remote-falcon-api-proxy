$(document).ready(function() {
  /**
   * Variables
   */

  //Global JWT variable to be used in all requests
  var _jwt = "";
  //Global URL variable for the Remote Falcon API (be sure to replace myshowsubdomain with your own)
  var _remoteFalconBaseUrl = "https://remotefalcon.com/remote-falcon-external-api";

  /**
   * JWT Stuff
   */

  //Gets the JWT from the generateJwt.php file
  $.ajax({ url: 'generate-jwt.php',
    data: {},
    type: 'post',
    success: function(jwt) {
      set_jwt(jwt);
    }
  });

  //Function to set the global JWT variable from the ajax call
  function set_jwt(jwt) {
    _jwt = jwt;
  }

  /**
   * Primary Page Functions
   */
  $('#getShowDetails').click(function() {
		getShowDetails();
	});

  //Get Sequences and put them in a table
  function getShowDetails() {
    $.ajax({
      url: _remoteFalconBaseUrl + "/showDetails",
      type: 'GET',
      beforeSend: function (xhr) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + _jwt);
      },
      data: {},
      success: function(details) {
        console.log(details);

        $('#viewerControlEnabled').html(details?.preferences?.viewerControlEnabled);
        $('#viewerControlMode').html(details?.preferences?.viewerControlMode);

        $('#playingNow').html(details?.playingNow);
        $('#playingNext').html(details?.playingNext);
        
      },
      error: function(error) {
        console.log(error);
      },
    });
  }
});