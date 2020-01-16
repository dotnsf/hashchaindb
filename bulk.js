//. bulk.js
var fs = require( 'fs' );
var request = require( 'request' );
var settings = require( './settings' );

if( process.argv.length < 4 ){
  console.log( '$ node bulk (baseurl) (dbname) (jsonarrayfilename)' );
}else{
  var baseurl = process.argv[2];
  var dbname = process.argv[3];
  var jsonarrayfilename = process.argv[4];

  var jsonarraystr = fs.readFileSync( jsonarrayfilename, 'utf-8' );
  var jsonarray = JSON.parse( jsonarraystr );

  //. 実際の処理はいわゆる「バルク処理」ではなく、マイニングしながらシーケンシャルに行う
  var idx = 0;
  syncSaveBody( baseurl, dbname, jsonarray, idx );
}

async function syncSaveBody( url, name, bodys, idx ){
  var len = bodys.length;
  if( idx >= len ){
    return true;
  }else{
    await syncSave( url, name, bodys[idx] );
    await syncSaveBody( url, name, bodys, idx + 1 );
  }
}

async function syncSave( url, name, body ){
  return new Promise( function( resolve, reject ){
    var option = {
      method: 'POST',
      url: url + '/block/' + name,
      json: true,
      form: body
    };
    request( option, function( err0, res0, body0 ){
      if( err0 ){
        resolve( false );
      }else{
        resolve( true );
      }
    });
  });
}
