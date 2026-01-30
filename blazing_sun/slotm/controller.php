<?php
$str_json = file_get_contents ('php://input');




function setCors()
{
    header ("Access-Control-Allow-Origin: blazingsun.space");
    header ("Content-type: application/json; charset=utf-8");
    header ("Server-Administrator: Don Milorad Đuković");
}


$jss = json_decode ($str_json);

$miler = [];
$array = [];
$array2 = [];
$array2i = [];
$gogor = [];
$noviKrediti = 0;
$noviKreditiPomocni = 0;
$varalica = '';
$dobitak = 0;
$brojLinija = 0;
$minigame = 0;
$counts = array_count_values ($jss->brojLinija);
$brojLinija = $counts[1];


for ($i = 0; $i < 5; $i++) {


    array_push ($array, rand (1, 6));

}




if ($jss->nacin == 1) {

    for ($i = 0; $i < count ($array); $i++) {
        if ($array[$i] == 6) {
            array_push ($array2, 1);
        } else {
            array_push ($array2, $array[$i] + 1);
        }

    }
    $array2 = array_merge ($array2, $array);


    for ($i = 0; $i < count ($array); $i++) {
        if ($array[$i] == 1) {
            array_push ($array2, 6);
        } else {
            array_push ($array2, $array[$i] - 1);
        }

    }
    if ($jss->dzoker > 0) {
        $array2[$jss->dzoker - 1] = 'jok';
    }

    for ($i = 0; $i < 7; $i++) {
        $array2i = [];
        if ($i == 0) {

            if ($jss->brojLinija[0] == 1) {

                $array2i = prebrojavanjeIstih ([$array2[5], $array2[6], $array2[7], $array2[8], $array2[9]], $array2i);




                $gogor = proveraDobitka ($array2i, $jss);

                $noviKreditiPomocni += end ($gogor);

                array_push ($gogor, $i);
                array_push ($miler, $gogor);





            }
        } else if ($i == 1) {
            if ($jss->brojLinija[1] == 1) {

                $array2i = prebrojavanjeIstih ([$array2[0], $array2[1], $array2[2], $array2[3], $array2[4]], $array2i);





                $gogor = proveraDobitka ($array2i, $jss);

                $noviKreditiPomocni += end ($gogor);

                array_push ($gogor, $i);
                array_push ($miler, $gogor);




            }
        } else if ($i == 2) {
            if ($jss->brojLinija[2] == 1) {

                $array2i = prebrojavanjeIstih ([$array2[10], $array2[11], $array2[12], $array2[13], $array2[14]], $array2i);






                $gogor = proveraDobitka ($array2i, $jss);

                $noviKreditiPomocni += end ($gogor);

                array_push ($gogor, $i);
                array_push ($miler, $gogor);




            }
        } else if ($i == 3) {
            if ($jss->brojLinija[3] == 1) {

                $array2i = prebrojavanjeIstih ([$array2[5], $array2[11], $array2[7], $array2[3], $array2[9]], $array2i);






                $gogor = proveraDobitka ($array2i, $jss);

                $noviKreditiPomocni += end ($gogor);

                array_push ($gogor, $i);
                array_push ($miler, $gogor);




            }
        } else if ($i == 4) {
            if ($jss->brojLinija[4] == 1) {

                $array2i = prebrojavanjeIstih ([$array2[5], $array2[1], $array2[7], $array2[13], $array2[9]], $array2i);






                $gogor = proveraDobitka ($array2i, $jss);

                $noviKreditiPomocni += end ($gogor);

                array_push ($gogor, $i);
                array_push ($miler, $gogor);




            }
        } else if ($i == 5) {
            if ($jss->brojLinija[5] == 1) {

                $array2i = prebrojavanjeIstih ([$array2[0], $array2[6], $array2[12], $array2[8], $array2[4]], $array2i);






                $gogor = proveraDobitka ($array2i, $jss);

                $noviKreditiPomocni += end ($gogor);

                array_push ($gogor, $i);
                array_push ($miler, $gogor);




            }
        } else if ($i == 6) {
            if ($jss->brojLinija[6] == 1) {

                $array2i = prebrojavanjeIstih ([$array2[10], $array2[6], $array2[2], $array2[8], $array2[14]], $array2i);






                $gogor = proveraDobitka ($array2i, $jss);


                $noviKreditiPomocni += end ($gogor);


                array_push ($gogor, $i);
                array_push ($miler, $gogor);




            }
        }
    }

    if ($jss->vrednostDzokera != 0) {
        if ($jss->vrednostDzokera == ($jss->ulog * 5)) {

            $noviKrediti = $jss->brojKredita - ($brojLinija * $jss->ulog + $jss->vrednostDzokera) + $noviKreditiPomocni;
            $varalica = 'Sve ok1';

        } else {
            $noviKrediti = 0;
            $varalica = 'Varali ste, krediti su vam oduzeti';
        }

    } else {
        $noviKrediti = $jss->brojKredita - ($brojLinija * $jss->ulog) + $noviKreditiPomocni;
        $varalica = 'Sve ok2';
    }
    $dobitak = $noviKreditiPomocni;
    if ($dobitak > 0) {
        $minigame = rand (0, 1);
    }
} else {



    $array2 = prebrojavanjeIstih($array, $array2);



    $miler = proveraDobitka($array2, $jss);
    
  

    if($miler !== 'nema dobitka'){
          $dobitak = end($miler);
        if ($dobitak > 0) {
            $minigame = rand (0, 1);
        }
    }

    $noviKrediti = $jss->brojKredita - $jss->ulog + (($miler !== 'nema dobitka') ? end($miler) : 0);
  
    array_push ($miler, 0);
    
    
    $varalica = 'Sve ok3';


}

function prebrojavanjeIstih($x, $y)
{

    $xx = $x;
    $yy = $y;
    if ($xx[0] == 'jok') {
        $xx[0] = $xx[1];
    } else if ($xx[4] == 'jok') {
        $xx[4] = $xx[3];
    }
    for ($i = 0; $i < count ($xx); $i++) {

        if ($xx[$i] == 'jok') {
            $xx[$i] = $xx[$i - 1];

        }


    }

    for ($i = 0; $i < count ($xx); $i++) {
        if ($i == 0) {
            array_push ($yy, $xx[$i]);

        } else {

            if ($yy[$i - 1] == $xx[$i]) {

                array_push ($yy, $xx[$i]);


            } else {
                break;
            }


        }

    }
   
    return $yy;

}



function proveraDobitka($x, $y)
{
    $miller = [];
    if (count ($x) == 1) {
        $miller = [0,0,0,0,0];
    } else {


        $miller = caseBroj ($x[0], count ($x), $y->kvote, $y->ulog);
    }

    return $miller;
}


function caseBroj($x, $y, $z, $k)
{


    switch ($x) {
        case 1:
            $sliced_array = array_slice ($z, -4, 4);
            $korti = caseKoliko ($x, $y, $sliced_array);
            break;
        case 2:
            $sliced_array = array_slice ($z, -4, 4);
            $korti = caseKoliko ($x, $y, $sliced_array);
            break;
        case 3:
            $sliced_array = array_slice ($z, 4, 4);
            $korti = caseKoliko ($x, $y, $sliced_array);
            break;
        case 4:
            $sliced_array = array_slice ($z, 4, 4);
            $korti = caseKoliko ($x, $y, $sliced_array);
            break;
        case 5:
            $sliced_array = array_slice ($z, 0, 4);
            $korti = caseKoliko ($x, $y, $sliced_array);
            break;
        case 6:
            $sliced_array = array_slice ($z, 0, 4);
            $korti = caseKoliko ($x, $y, $sliced_array);
            break;
    }

    array_push ($korti, (int) $k, $k * $korti[2]);

    return $korti;
}



function caseKoliko($x, $y, $z)
{


    switch ($y) {

        case 2:
            $kvota = $z[3];
            break;
        case 3:
            $kvota = $z[2];
            break;
        case 4:
            $kvota = $z[1];
            break;
        case 5:
            $kvota = $z[0];
            break;
    }

    return [$x, $y, $kvota];
}




array_push ($array, $str_json, $varalica, $dobitak, $noviKrediti, $minigame, $miler);

setCors ();

echo json_encode ($array);
