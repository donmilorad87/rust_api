<?php
require_once(__DIR__ .'/core/init.php');
$DB = new Db(DBHost, DBPort, DBName, DBUser, DBPassword);
if(isset($_POST['index']) || !empty($_POST['index'])){
$arr2 = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30];	
$arr3=[];
$arr4=[];
$arr5=[];
$index = $_POST['index'];
$object;
$ges=0;


for ($i = 0; $i < 12; $i++) {
	shuffle($arr2);
	$miler = $arr2[5];
	unset($arr2[5]);
	

array_push($arr3,$miler);
	
}



$pieces = explode("|,", $index);

for($i=0;$i<sizeof($pieces);$i++){
if(str_replace("|","",$pieces[$i])){
	$pieces[$i]=str_replace("|","",$pieces[$i]);
}else{
	$pieces[$i] = $pieces[$i];
}
}
$pomocnik = 0;
for($i=0;$i<5;$i++){

	$pepi = explode(",", $pieces[$i]);
	
	
	$pes=sizeof($pepi);

	for($j=0;$j<$pes;$j++){

	 if (in_array($pepi[$j], $arr3))
			  {
			  $ges++;
			  }
			 
	}
	$object = new stdClass();
	$object->tiket = $i;

	
	if($pepi[0] === '|'){
		$object->odigrano = strval( 0 );
	}
	else if($pepi[0] === ''){
		$object->odigrano = strval( 0 );
	}
	
	else{
		$object->odigrano = strval( $pes );
	}
	

	
	$object->pogodjeno = strval( $ges );


	
	


	switch ($pes) {
		case 1:
				$object->dobitak='';
				$kvota = 0;
				if($ges == 1){
					$kvota = '2.5';
				}
				$object->dobitak = floatval($kvota) * 20;
				$pomocnik = $pomocnik + floatval($kvota) * 20;	
				
			break;
		case 2:
				$object->dobitak='';
				$kvota = 0;
				if($ges == 0){
						$kvota = '0.00';
					}
				else if($ges == 1){
						$kvota = '0.62';
					}
				else if($ges == 2){
					$kvota = '6.59';
				} 	
				$object->dobitak = floatval($kvota) * 40;
				$pomocnik = $pomocnik + floatval($kvota) * 40;	
			break;
		case 3:
				$object->dobitak='';
				$kvota = 0;
				if($ges == 0){
						$kvota = '0.00';
					}
				else if($ges == 1){
						$kvota = '0.27';
					}
				else if($ges == 2){
					$kvota = '2.89';
				} 
				else if($ges == 3){
					$kvota = '18.45';
				} 
				
				$object->dobitak = floatval($kvota) * 60;
				$pomocnik = $pomocnik + floatval($kvota) * 60;	
			break;
		case 4:
				$object->dobitak='';
				$kvota = 0;
				if($ges == 0){
						$kvota = '0.00';
					}
				else if($ges == 1){
						$kvota = '0.15';
					}
				else if($ges == 2){
					$kvota = '1.64';
				} 
				else if($ges == 3){
					$kvota = '10.64';
				}
				else if($ges == 4){
					$kvota = '55.36';
				} 
			$object->dobitak = floatval($kvota) * 80;
			$pomocnik = $pomocnik + floatval($kvota) * 80;			
			break;
		case 5:
				$object->dobitak='';
				$kvota = 0;
				if($ges == 0){
						$kvota = '0.00';
					}
				else if($ges == 1){
						$kvota = '0.10';
					}
				else if($ges == 2){
					$kvota = '1.05';
				} 
				else if($ges == 3){
					$kvota = '7.33';
				}
				else if($ges == 4){
					$kvota = '35.43';
				}
				else if($ges == 5){
					$kvota = '179.94';
				} 
						$object->dobitak = floatval($kvota) * 100;
						$pomocnik = $pomocnik + floatval($kvota) * 100;
			break;	
		default:
			echo "Your favorite color is neither red, blue, nor green!";
	}
		$object->pomocnik = $pomocnik;
		array_push($arr4,$object);
			$ges=0;
}

$arr5 =[
'brojevi' =>json_encode($arr3),
'izvestaj' =>json_encode($arr4),
'dobitak' => $pomocnik,
'parametar' => 'dvanaestRandomBrojeva',
'info' => 'Dvanaest slucajno odabranih brojeva i rezultati vaSih odabranih kombinacija.'

];


echo json_encode($arr5);

}

else if (isset($_POST['proveriToken']) || !empty($_POST['proveriToken'])){
	
		
	$kell=$DB->query("SELECT nivoPristupa FROM stranica WHERE ime=?",array($_POST['stranica']));

	if($kell[0]['nivoPristupa'] >= $_POST['nivoPristupa']){
			$niz=[
				'parametar' => 'nePristup',
				'info' => 'Nemate dovoljno pristupa za ovu stranicu'
				];	
	}
	else{
		$niz=[
				'parametar' => 'daPristup',
				'info' => 'Imate dovoljno pristupa za ovu stranicu'
				];	
		

		$kel2=$DB->query("SELECT token FROM korisnik WHERE username=?",array($_POST['korisnik']));
		$kel3=$DB->query("SELECT stranica FROM korisnik WHERE username=?",array($_POST['korisnik']));		
		if($kel2[0]['token'] == $_POST['token'] && $kel3[0]['stranica'] == $_POST['stranica']){



		$niz=[ 
				'parametar' => 'daPristup',
				'info' => 'Imate dovoljno pristupa za ovu stranicu a i token vam je autentifikovan',
				'token' => $kel2[0]['token'],
				'stranica' => $kel3[0]['stranica'],
				'nivoPristupa' => $_POST['nivoPristupa'],
				'stranicaR' => $_POST['stranica'],
				'korisnikR' => $_POST['korisnik'],
				'adresa' =>'https://blazingsun.space/'.$kel3[0]['stranica'],
				'naslov' => ucfirst($kel3[0]['stranica']) .' | Blazing Sun'
				];					
		}
		else{
			$niz=[
				'parametar' => 'nePristup',
				'info' => 'Imate dovoljno pristupa ali vas token nije prosao autentifikaciju',
				'token' => $kel2[0]['token'],
				'stranica' => $kel3[0]['stranica'],
				'nivoPristupa' => $_POST['nivoPristupa'],
				'stranicaR' => $_POST['stranica'],
				'korisnikR' => $_POST['korisnik'],
				'adresa' =>'https://blazingsun.space/'.$kel3[0]['stranica'],
				'naslov' => ucfirst($kel3[0]['stranica']) .' | Blazing Sun'
				
				];	
		}
	}
	echo json_encode($niz);
}
else if (isset($_POST['napraviToken']) || !empty($_POST['napraviToken'])){

	if($_POST['napraviToken'] == 'da'){
			
			
		$imeSHash=$DB->single("SELECT hash FROM stranica WHERE ime=? ",array($_POST['stranica']));
		
		$microEnc=pred_my_simple_crypt( $_POST['microtimeh'],'e' );
		$korisnikEnc=pred_my_simple_crypt( $_POST['korisnik'],'e' );
		
			
		$imeSHash = $imeSHash . '|' .$_POST['microtimeh'] . '|' . $_POST['korisnik'];
		
		$token = my_simple_crypt( $imeSHash, 'e' , $microEnc, $korisnikEnc);
		
		if($DB->query("UPDATE korisnik SET token = :token WHERE username = :username", array("username"=>$_POST['korisnik'],"token"=>$token)) && $DB->query("UPDATE korisnik SET stranica = :stranica WHERE username = :username", array("username"=>$_POST['korisnik'],"stranica"=>$_POST['stranica']))){
	
		
			$niz=[
				'parametar' => 'daTokenUspesan',
				'info' => 'Uspesno dodat Token',
				'token' => $token,
				'usernameUspeh' => $_POST['korisnik'],
				'stranica' => $_POST['stranica']
				];
		}
		else{
				$niz=[
				'parametar' => 'neTokenUspesan',
				'info' => 'Neuspesno dodat Token',
				'usernameNeuspeh' => $_POST['korisnik'],
				'stranicaNeuspeh' => $_POST['stranica']
				];
		}
		
				echo json_encode($niz);
		
	}
}
else if (isset($_POST['pokazivacReg']) || !empty($_POST['pokazivacReg'])){
	
$kel= $DB->single("SELECT COUNT(1) FROM korisnik WHERE username=? ",array($_POST['usernameReg']));
$kee= $DB->single("SELECT COUNT(1) FROM korisnik WHERE email=? ",array($_POST['email']));
	if($kel>1){
		echo 'To korisnicko ime vec postoji';
	}
	else if($kee>1){
		echo 'Taj email vec postoji';
	}
	else{
	$hash=$_POST['usernameReg'] . '|' . $_POST['email'] . '|' . $_POST['passwordReg'];
	$hash = pred_my_simple_crypt( $hash, 'e' );
	$salt= microtime() .'|'. $_POST['passwordReg'];
	$salt = pred_my_simple_crypt( $salt, 'e' );
	
	$password_hasshed = my_simple_crypt( $_POST['passwordReg'], $action = 'e' , $hash, $salt);
	
	$DB->query("INSERT INTO korisnik(username,email,pass,hash,salt) VALUES(?,?,?,?,?)", array($_POST['usernameReg'],$_POST['email'],$password_hasshed,$hash,$salt));
	
	$niz=[
		'parametar' => 'aktivacijaPoslata',
		'info' => 'UspeSno ste zapoceli proces registracije! Aktivacioni email vam je poslat na odabranu email adresu. Aktivirajte nalog ukoliko zelite da zavrSite registraciju.'
		];

	
	sendMail($_POST['usernameReg'],$hash,$_POST['email'],'Blazing Sun Aktivacija Naloga','ne');
	echo json_encode($niz);
}
}
else if (isset($_POST['usernameCheck']) || !empty($_POST['usernameCheck'])){
	$kel= $DB->single("SELECT COUNT(1) FROM korisnik WHERE username=? ",array($_POST['usernameReg']));

		
		if($kel >= 1){
		

		$niz=[
		'parametar' => 'neUsername',
		'info' => 'Korisnicko je zauzeto'
		];
	
	}
	else{
		
		$niz=[
		'parametar' => 'daUsername',
		'info' => 'Korisnicko nije zauzeto'
		];
			
	}
		
		
	
	echo json_encode($niz);
	
}
else if (isset($_POST['usernameCheckLog']) || !empty($_POST['usernameCheckLog'])){
	$kel= $DB->single("SELECT COUNT(1) FROM korisnik WHERE username=? ",array($_POST['usernameCheckLog']));
	if($kel == 0){
		$niz=[
		'parametar' => 'noUsernameLog',
		'info' => 'Korisnicko ime ne postoji'
		];
	}else{
		$niz=[
		'parametar' => 'yesUsernameLog',
		'info' => 'Korisnicko ime postoji'
		];
	}
		echo json_encode($niz);
	
}
else if (isset($_POST['connection']) || !empty($_POST['connection'])){
	if($DB->query("SELECT * FROM korisnik WHERE username=?",array('milorad'))){
		$niz=[
		'parametar' => 'konekcijaUspesna',
		'info' => 'Test konekcija prošla uspešno'
		];
	}else{
		$niz=[
		'parametar' => 'konekcijaNeuspesna',
		'info' => 'Test konekcija proSla neuspeSno'
		];
	}
	echo json_encode($niz);
}
else if (isset($_POST['emailCheck']) || !empty($_POST['emailCheck'])){
	$kel= $DB->single("SELECT COUNT(1) FROM korisnik WHERE email=? ",array($_POST['email']));

				if($kel >= 1){
		

		$niz=[
		'parametar' => 'neEmail',
		'info' => 'Email je zauzet'
		];
	
	}
	else{
		
		$niz=[
		'parametar' => 'daEmail',
		'info' => 'Email nije zauzet'
		];
			
	}
		
		
	echo json_encode($niz);

	
}
else if (isset($_POST['active']) || !empty($_POST['active'])){
		
		if($DB->single("SELECT COUNT(1) FROM korisnik WHERE hash=? ",array($_POST['active']))){
			
					if($DB->single("SELECT COUNT(1) FROM korisnik WHERE hash=? ",array($_POST['active'])) >= 1){
					
					$DB->query("UPDATE korisnik SET active = ? WHERE hash = ?", array(1,$_POST['active']));
					$niz=[
					'parametar' => 'nalogAktiviran',
					'info' => 'Korisnicki nalog je aktiviran, sada se mozete loginovati.'
					];
				
				}
				else{
					
					$niz=[
					'parametar' => 'nalogNijeAktiviran',
					'info' => 'Korisnicki nalog nije aktiviran, desio se neki problem. Ne postoji takav korisnicki HASH.'
					];
						
				}
	}
	else{
			$niz=[
		'parametar' => 'nalogNijeAktiviranGreska',
		'info' => 'Korisnicki nalog nije aktiviran, desio se neki problem. 2'
		];
	}
	echo json_encode($niz);
}
else if (isset($_POST['pokazivacLog']) || !empty($_POST['pokazivacLog'])){
	$kel= $DB->single("SELECT COUNT(1) FROM korisnik WHERE username=? ",array($_POST['pokazivacLog']));
	if($kel>=1){
		$kell=$DB->query("SELECT * FROM korisnik WHERE username=?",array($_POST['pokazivacLog']));
		
		if($kell[0]['active'] != 0){
			
			$passaca = my_simple_crypt( $kell[0]['pass'], 'd' , $kell[0]['hash'], $kell[0]['salt']);
			
			if($passaca == $_POST['passwordLog']){
						$niz=[
							'parametar' => 'uspesnoLogovanje',
							'info' => 'Uspesno ste se logovali na vas nalog',
							'korisnik' => $_POST['pokazivacLog'],
							'zapMe' => $_POST['zapMe']
							];
			}
			else{
			
					$niz=[
							'parametar' => 'neuspesnoLogovanje',
							'info' => 'Vas password nije tacan',
							'korisnik' => $_POST['pokazivacLog'],
							'zapMe' => $_POST['zapMe']
							
							];
					
			}
		}
		else{
				$niz=[
							'parametar' => 'neuspesnoLogovanje',
							'info' => 'Vas nalog nije aktiviran, proverite email',
							'korisnik' => $_POST['pokazivacLog'],
							'zapMe' => $_POST['zapMe']
							];
		}
	}
	else{
		$niz=[
							'parametar' => 'neuspesnoLogovanje',
							'info' => 'Ne postoji takvo korisnicko ime',
							'korisnik' => $_POST['pokazivacLog'],
							'zapMe' => $_POST['zapMe']
							];
	}
	
		echo json_encode($niz);
}
else {
	$niz=[
							'parametar' => 'nemaParametara',
							'info' => 'Nema parametara'
							];
	echo json_encode($niz);
}

function sendMail($korisnik,$hash,$mail,$naslov,$uslov){
	
	$msg = "<div><h1 style='width:100%; text-align:center;'> Aktivacija naloga za Blazing Sun Bingo</h1><p>PoStovani <b>". $korisnik ."</b> uspeSno ste predali prijavu za registraciju na Blazing Sun Bingo.</p><p>Ukoliko i dalje zelite da aktivirate vaS nalog pritisnite dugme 'Aktiviraj' <a style='border:2px solid black; padding:8px; font-weight:900;' href='https://blazingsun.space?aktivirajNalog=". $hash ."' target='_blank'> Aktiviraj nalog</a></p><p>Nakon aktivacije naloga bicete redirektovani na Blazing Sun Bingo i kao poklon dobicete 100 000 kredita.<p><p> Srecno</p></div>";


$msg = wordwrap($msg,2000);

$to      = $mail;
$subject = $naslov;
$message = $msg;
$headers = 'From: Blazing Sun Bingo blazingsun@blazingsun.space' . "\r\n" .
	'MIME-Version: 1.0' . "\r\n" .
	'Content-type: text/html; charset=UTF-8' . "\r\n" .
    'Reply-To: office@blazingsun.com' . "\r\n" .
    'X-Mailer: PHP/' . phpversion();

$success= mail($to, $subject, $message, $headers);
if (!$success) {
   $niz=[
		'parametar' => 'Mail nije poslat',
		'info' => 'Slanje maila neuspeSno. Molim vas pokuSajte ponovo.'
		];
}
else{
	
	
	$niz=[
		'parametar' => 'Mail je poslat',
		'info' => 'Slanje maila uspeSno.'
		];
	
	
	
}
if($uslov == 'ne'){
	
}
else if($uslov == 'da'){
	echo json_encode($niz);
}




	
}



function my_simple_crypt( $string, $action = 'e' , $kljuc, $kljucic) {
    // you may change these values to your own
    $secret_key = $kljuc;
    $secret_iv = $kljucic;
 
    $output = false; 
    $encrypt_method = "AES-256-CBC";
    $key = hash( 'sha256', $secret_key );
    $iv = substr( hash( 'sha256', $secret_iv ), 0, 16 );
 
    if( $action == 'e' ) {
        $output = base64_encode( openssl_encrypt( $string, $encrypt_method, $key, 0, $iv ) );
    }
    else if( $action == 'd' ){
        $output = openssl_decrypt( base64_decode( $string ), $encrypt_method, $key, 0, $iv );
    }
 
    return $output;
}

function pred_my_simple_crypt( $string, $action = 'e' ) {
    // you may change these values to your own
	$secret_key = 'my_simple_secret_key2019';
    $secret_iv = 'my_simple_secret_iv2019';
 
    $output = false;
    $encrypt_method = "AES-256-CBC";
    $key = hash( 'sha256', $secret_key );
    $iv = substr( hash( 'sha256', $secret_iv ), 0, 16 );
 
    if( $action == 'e' ) {
        $output = base64_encode( openssl_encrypt( $string, $encrypt_method, $key, 0, $iv ) );
    }
    else if( $action == 'd' ){
        $output = openssl_decrypt( base64_decode( $string ), $encrypt_method, $key, 0, $iv );
    }
 
    return $output;
}
		

?>