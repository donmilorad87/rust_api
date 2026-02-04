'use strict';

import DrawLines from '/slotm/assets/script/classes/draw_lines.js';

export default class SlotWeels extends DrawLines {

    constructor() {

        super()

        this.slotObject = {
            brojKredita: 1000,
            ulog: 2,
            kvote: [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3],
            brojac: 0,
            pomagac: 0,
            stopArray: [],
            spinovi: document.getElementsByClassName('carousel'),
            scene: document.getElementsByClassName('scene'),
            okvir: document.getElementById('myCanvas'),
            ukupanulog: document.getElementById('ukupanulog'),
            igradzoker: document.getElementById('igraDzoker'),
            igrabrojlinija: document.getElementById('igraBrojLinija'),
            brojkreditadiv: document.getElementById('brojKredita'),
            igraulog: document.getElementById('igraUlog'),
            igra: document.getElementById('igra'),
            nag2: document.getElementById('nag2'),
            brake: document.getElementsByClassName('brake'),
            tabele: document.getElementById('kiki').getElementsByTagName('table'),
            radioEventElements: [document.getElementsByClassName('cosma'), document.getElementsByClassName('gozma'), document.getElementsByClassName('gigozma')],
            zaustaviRotacijuEvent: this.zaustaviRotaciju.bind(this),
            pokreniOkretanjeSlotovaEvent: this.pokreniOkretanjeSlotova.bind(this),
            tipIgreEvent: this.tipIgre.bind(this),
            promeniBetIgreEvent: this.promeniBetIgre.bind(this),
            promeniNacinNagradjivanjaEvent: this.promeniNacinNagradjivanja.bind(this),
            progressInterval: null

        }

        this.aktivirajEventeNaRadioButtons()
        this.dodalListenere()



    }
	
	
	
    promeniNacinNagradjivanja() {

        this.checkNacin(document.querySelector('input[name="nag"]:checked'))

    }

    promeniBetIgre() {

        let x = document.querySelector('input[name="bet"]:checked')

        if (x.id === 'bet4') {
            this.checkerLast(x)
        } else {
            this.checker(x)
        }

    }

    tipIgre() {

        let x = document.querySelector('input[name="tipIgre"]:checked')

        if (x.id === 'tip5') {
            this.checkerLast(x)

        } else {

            this.checker(x)
        }

    }

    
    aktivirajEventeNaRadioButtons() {

        for (let i = 0; i < this.slotObject.radioEventElements.length; i++) {
            for (let j = 0; j < this.slotObject.radioEventElements[i].length; j++) {
                this.slotObject.radioEventElements[i][j].onclick = () => {
                    if (this.slotObject.radioEventElements[i][j].getElementsByTagName('input')[0].checked === false) {

                        if (this.slotObject.radioEventElements[i][j].querySelector('input[name="tipIgre"]')) {

                            this.napraviSpinove(this.slotObject.radioEventElements[i][j].getElementsByTagName('input')[0].value - 1)
                            this.slotObject.igra.textContent = this.slotObject.radioEventElements[i][j].getElementsByTagName('label')[0].textContent;
                            this.getUkupanUlog()

                        } else if (this.slotObject.radioEventElements[i][j].querySelector('input[name="bet"]')) {

                            this.pomocnikZaPromenuUloga(this.slotObject.radioEventElements[i][j].getElementsByTagName('input')[0].value)

                        } else if (this.slotObject.radioEventElements[i][j].querySelector('input[name="nag"]')) {

                            this.checkNacin(document.querySelector('input[name="nag"]:checked'))

                        }

                        this.slotObject.radioEventElements[i][j].parentElement.querySelector('input:checked').parentElement.style.background = 'white'
                        this.slotObject.radioEventElements[i][j].getElementsByTagName('input')[0].checked = true;
                        this.slotObject.radioEventElements[i][j].style.background = 'lightgreen'

                    }
                }
            }

        }
    }
	
	
	izbrisiEventeNaRadiouButtons() {

        for (let i = 0; i < this.slotObject.radioEventElements.length; i++) {
            for (let j = 0; j < this.slotObject.radioEventElements[i].length; j++) {
                this.slotObject.radioEventElements[i][j].onclick = null
            }
        }
    }

	
	
	
    getUkupanUlog(x = 0) {
        

        if (x === 0) {
            if (this.slotObject.nag2.checked) {
                this.slotObject.ukupanulog.textContent = this.slotObject.ulog
            } else {
                this.slotObject.ukupanulog.textContent = this.brojacLinija() * this.slotObject.ulog + this.getVrednostDzokera(this.slotObject.ulog)
            }
        } else {
            return this.brojacLinija() * this.slotObject.ulog + this.getVrednostDzokera(this.slotObject.ulog)
        }
    }


	  getVrednostDzokera(x) {

        if (this.jokerAdded) {

            this.vrednostDzokera = x * 5
        } else {
            this.vrednostDzokera = 0
        }

        return this.vrednostDzokera


    }

    checkNacin(x) {

        if (x.id === 'nag2') {
            this.checker(x)

        } else {
            this.checkerLast(x)

        }

    }

    checker(x) {
        let xx = x.parentElement.nextElementSibling.querySelector('input')
        if (x.name === "tipIgre") {

            this.napraviSpinove(parseInt(x.value))
            this.slotObject.igra.textContent = x.parentElement.nextElementSibling.querySelector('label').textContent;
            this.getUkupanUlog()

        } else if (x.name === "bet") {

            this.pomocnikZaPromenuUloga(xx.value)

        } else if (x.name === "nag") {

            this.perspectiveNo();

            this.ocistiCanvas()
            this.lineCheck()

            if (this.jokerAdded) {

                this.dodajDzokera(this.kkk1, this.kkk2)

                this.slotObject.igradzoker.textContent = 'DA (' + this.getVrednostDzokera(this.slotObject.ulog) + ' $)'
                document.getElementById('joker').checked;
                document.getElementById('joker').disabled;
            }

        }

        this.radoiHelper(x)
        xx.checked = true
        x.parentElement.nextElementSibling.style.background = 'lightgreen'
    }

    checkerLast(x) {

        let xx = x.parentElement.parentElement.firstChild.nextElementSibling.querySelector('input')

        if (x.name === "tipIgre") {

            this.napraviSpinove(0)
            this.slotObject.igra.textContent = x.parentElement.parentElement.firstChild.nextElementSibling.querySelector('label').textContent;
            this.getUkupanUlog()

        } else if (x.name === "bet") {

            this.pomocnikZaPromenuUloga(xx.value)

        } else if (x.name === "nag") {
			this.perspectiveYes();
            

        }

        this.radoiHelper(x)
		
        xx.checked = true
        x.parentElement.parentElement.firstChild.nextElementSibling.style.background = 'lightgreen'
    }
	

	radoiHelper(x){
		x.checked = false
        x.parentElement.style.background = 'white'
	}
	
  

    pomocnikZaPromenuUloga(x) {
        this.slotObject.igraulog.textContent = x
        if (this.slotObject.nag2.checked) {
            this.slotObject.ukupanulog.textContent = x
        } else {
            this.slotObject.ukupanulog.textContent = this.brojacLinija() * x + this.getVrednostDzokera(x)
        }

        if (this.jokerAdded) {

            if (this.slotObject.nag2.checked) {
                this.slotObject.igradzoker.textContent = ' NE (0 $)';
            } else {
                this.slotObject.igradzoker.textContent = 'DA (' + x * 5 + ' $)'
            }

        }

        this.slotObject.ulog = x
    }

    napraviSpinove(tipIgre) {

        let brojevi = [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]
        let brojeviKvote = [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3]
        let rBrojevi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'I', 'II', 'III', 'IV', 'V', 'VI']
        let rBrojeviKvote = [90, 40, 28, 4, 40, 28, 18, 3, 28, 18, 8, 2]
        let vockice = ['🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉']
        let vockiceKvote = [200, 100, 60, 8, 100, 60, 40, 7, 60, 40, 20, 6]
        let zivotinje = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊']
        let zivotinjeKvote = [150, 70, 40, 7, 70, 40, 30, 6, 40, 30, 15, 5]
        let emoji = ['😀', '😁', '😂', '🤣', '😅', '😎', '😀', '😁', '😂', '🤣', '😅', '😎']
        let emojiKvote = [120, 60, 35, 6, 60, 35, 25, 5, 35, 25, 12, 4]
		
		
		switch (tipIgre) {
			    case 0:

			
						this.pomocnaFunct(brojevi, brojeviKvote)
                        this.pomocnikZaZetone([2, 3, 4, 5, 6])
						this.ispisiBrojeveUSlotove(brojevi)
					
				break;
			    case 1:

					
						this.pomocnaFunct(rBrojevi, rBrojeviKvote)
                        this.pomocnikZaZetone([1, 2, 3, 4, 5])
						this.ispisiBrojeveUSlotove(rBrojevi)
					
				break;
			    case 2:

		
						this.pomocnaFunct(vockice, vockiceKvote)
                        this.pomocnikZaZetone([5, 6, 7, 8, 9])
						this.ispisiBrojeveUSlotove(vockice)
				
				break;
				case 3:

					
						this.pomocnaFunct(zivotinje, zivotinjeKvote)
                        this.pomocnikZaZetone([4, 5, 6, 7, 8])
						this.ispisiBrojeveUSlotove(zivotinje)
					
				break;
				case 4:

			
						this.pomocnaFunct(emoji, emojiKvote)
                        this.pomocnikZaZetone([3, 4, 5, 6, 7])
						this.ispisiBrojeveUSlotove(emoji)
				
				break;
			}	
		
		
      

        if (this.slotObject.nag2.checked) {
            this.perspectiveYes();

        } else {
            this.perspectiveNo();
        }

    }
	
	
	ispisiBrojeveUSlotove(array){
		  for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 12; j++) {
              

                    this.slotObject.spinovi[i].getElementsByTagName("p")[j].textContent = array[j]

            }
			
            this.slotObject.spinovi[i].style.cssText = 'translateZ(-336px) rotateX(0deg);transition:0.1s;';
        }
	}

    perspectiveNo() {

        for (let i = 0; i < 5; i++) {
            this.slotObject.scene[i].setAttribute('style', 'perspective: initial;transition: 0.3s;');

        }

        this.perspectiveHelper('100%', '0', 'block', 'block', this.brojacLinija())
		spinovi.style.cssText = 'overflow:hidden; margin-bottom: 18px;'
        this.slotObject.ukupanulog.textContent = this.slotObject.ulog * this.brojacLinija() + this.getVrednostDzokera(this.slotObject.ulog)

    }

    perspectiveYes() {

        this.ocistiCanvas()

        for (let i = 0; i < 5; i++) {
            this.slotObject.scene[i].setAttribute('style', 'perspective: 1000px;transition: 0.3s;');
        }

        this.perspectiveHelper('180px', 'calc(50% - 90px)', 'none', 'none', 1)
		spinovi.style.cssText = 'overflow:initial; margin-bottom: 22px;'
        this.slotObject.ukupanulog.textContent = this.slotObject.ulog
        this.slotObject.igradzoker.textContent = " NE (0 $)"

    }

    perspectiveHelper(x, y, z, k, j) {
        this.slotObject.okvir.style.height = x
        this.slotObject.okvir.style.top = y
        document.getElementById('linije').style.display = z
        document.getElementById('jokerCont').style.display = k
        this.slotObject.igrabrojlinija.textContent = j

    }

    pomocnaFunct(array, array2) {
        this.slotObject.kvote = array2
        for (let i = 0; i < 3; i++) {
            if (i === 0) {
                this.pomocnikPonocneFunkcije([array[4], array[5]], i)
                this.pomocnikZaKvote([array2[0], array2[1], array2[2], array2[3]], i)
            } else if (i === 1) {

                this.pomocnikPonocneFunkcije([array[2], array[3]], i)
                this.pomocnikZaKvote([array2[4], array2[5], array2[6], array2[7]], i)
            } else if (i === 2) {

                this.pomocnikPonocneFunkcije([array[0], array[1]], i)
                this.pomocnikZaKvote([array2[8], array2[9], array2[10], array2[11]], i)
            }
        }
    }

    pomocnikZaZetone(array) {
        let cosma = document.getElementsByClassName('cosma');

        for (let i = 0; i < cosma.length; i++) {
            cosma[i].querySelector('input').value = array[i]
            cosma[i].querySelector('label').textContent = array[i] + '$'
        }

        this.slotObject.igraulog.textContent = document.querySelector('input[name="bet"]:checked').value
        this.slotObject.ulog = document.querySelector('input[name="bet"]:checked').value
        if (document.getElementById('izbrisiDzokera')) {
            if (this.slotObject.nag2.checked) {
                this.slotObject.igradzoker.textContent = ' NE (0 $)'
            } else {

                this.slotObject.igradzoker.textContent = 'DA (' + (document.querySelector('input[name="bet"]:checked').value * 5) + ' $)'

            }

        }

    }

    pomocnikZaKvote(array, i) {
        for (let j = 0; j < 4; j++) {
            this.slotObject.tabele[i].getElementsByTagName('tr')[j].getElementsByTagName('td')[5].textContent = array[j]
        }
    }

    pomocnikPonocneFunkcije(array, i) {
        this.slotObject.tabele[i].getElementsByTagName('caption')[0].textContent = 'Kvota za ' + array[0] + ' || ' + array[1]

        this.slotObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[0].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[1].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[2].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[0].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]

        this.slotObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[1].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[2].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[1].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]

        this.slotObject.tabele[i].getElementsByTagName('tr')[2].getElementsByTagName('td')[2].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[2].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[2].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]

        this.slotObject.tabele[i].getElementsByTagName('tr')[3].getElementsByTagName('td')[3].textContent = array[0] + ' || ' + array[1]
        this.slotObject.tabele[i].getElementsByTagName('tr')[3].getElementsByTagName('td')[4].textContent = array[0] + ' || ' + array[1]
    }

    rotateSlots(array) {

        document.getElementById('linije').style.pointerEvents = 'none'

        this.rotating(array)
		
		
		
		let sendObj = {

            "ulog": this.slotObject.ulog,
            "igra": document.querySelector('input[name="tipIgre"]:checked').value,
            "kvote": this.slotObject.kvote,
            "brojLinija": (this.slotObject.nag2.checked) ? [1,0,0,0,0,0,0] : this.linez,
            "dzoker": (this.slotObject.nag2.checked) ? 0 : this.dzoker,
            "vrednostDzokera": (this.slotObject.nag2.checked) ? 0 : this.vrednostDzokera,
            "nacin": document.querySelector('input[name="nag"]:checked').value,
            "brojKredita": this.slotObject.brojKredita

        }

        console.log(sendObj)
		
        this.postData('controller.php', sendObj)
            .then((data) => {
                this.slotObject.pomagac--
                this.slotObject.brojac++
                this.slotObject.stopArray = data;
                console.log('data', data)
                console.log(data[5])
                this.rotating(data)

				

                document.getElementById('stoper').addEventListener('click', this.slotObject.zaustaviRotacijuEvent)

                let timeleft = 5;
                this.slotObject.progressInterval = setInterval(() => {
                    if (timeleft <= 0) {

                        clearInterval(this.slotObject.progressInterval)

                        this.progresPomocnik()

                        this.pointerAll()
                        this.upisivacKredita(data)

                    } else {

                        document.getElementById('preostalo').style.visibility = 'visible';
                        document.getElementById('preostalo').textContent = timeleft + ' sec';
                        document.getElementById('progressBar').value = 5 - timeleft;
                        timeleft -= 1;
                    }

                }, 1000);
            })
		

    }

	rotating(array){

			for (let i = 0; i < 5; i++) {

            if (this.slotObject.pomagac === 0) {
                this.slotObject.spinovi[i].style.cssText = "transform: translateZ(-336px) rotateX(" + (360 * (Math.floor(Math.random() * (15 - 10 + 1)) + 10) + (-30) * (array[i] - 1)) + "deg); transition-delay:" + 0.2 * i + "s; transition-duration: 5s;";
                this.slotObject.pomagac++
			
            } else {
                this.slotObject.spinovi[i].style.cssText = "transform: translateZ(-336px) rotateX(" + (-360 * (Math.floor(Math.random() * (10 - 5 + 1)) + 5) + (-30) * (array[i] - 1)) + "deg); transition-delay:" + 0.2 * i + "s; transition-duration: 5s;";
                this.slotObject.pomagac = 0
				
            }
			
        }
			
	}
    stopSlots() {

        for (let i = 0; i < 5; i++) {

            this.slotObject.spinovi[i].style.cssText = 'transform: translateZ(-336px) rotateX(' + (-30) * ((this.slotObject.stopArray[i] - 1)) + 'deg); transition-duration: 0s;';
        }

        this.pointerAll()

        this.upisivacKredita(this.slotObject.stopArray)

    }

    pointerAll() {


        document.getElementById('linije').style.pointerEvents = 'auto'
        document.getElementById('stoper').removeEventListener('click', this.slotObject.zaustaviRotacijuEvent)

        this.dodalListenere()

        document.getElementById('brake').style.pointerEvents = "auto";
        document.getElementById('linija1').style.opacity = "1";
    }

    

    zaustaviRotaciju() {

        clearInterval(this.slotObject.progressInterval);

        this.progresPomocnik()

        this.stopSlots();

    }

    progresPomocnik() {
        document.getElementById('preostalo').textContent = '5 sec';
        document.getElementById('progressBar').value = 0;
        document.getElementById('preostalo').style.visibility = 'hidden';
    }

	dodalListenere() {
        this.lining(document.getElementById('linije').getElementsByTagName('input'))

        document.getElementById('joker').addEventListener('click', this.jokerCheckboxEvent)

        if (!this.jokerAdded) {
            document.getElementById('joker').disabled = false
        }

        if (document.getElementById('snimiDzokera')) {
            document.getElementById('snimiDzokera').addEventListener('click', this.myloader3);
        }

        if (document.getElementById('izbrisiDzokera')) {
            document.getElementById('izbrisiDzokera').addEventListener('click', this.myloader4);
        }

        this.aktivirajEventeNaRadioButtons();
        document.getElementById('pokreniIgru').addEventListener('click', this.slotObject.pokreniOkretanjeSlotovaEvent);
        document.getElementById('game-button').addEventListener('click', this.slotObject.tipIgreEvent);
        document.getElementById('bet-button').addEventListener('click', this.slotObject.promeniBetIgreEvent);
        document.getElementById('game-button-nacin').addEventListener('click', this.slotObject.promeniNacinNagradjivanjaEvent);

    }

    skiniListenere() {
        this.obrisiLiningEvents(document.getElementById('linije').getElementsByTagName('input'))
        document.getElementById('brake').style.pointerEvents = "none";
        document.getElementById('linija1').style.opacity = "0.5";

        document.getElementById('joker').removeEventListener('click', this.jokerCheckboxEvent)
        document.getElementById('joker').disabled = true

        if (document.getElementById('snimiDzokera')) {
            document.getElementById('snimiDzokera').removeEventListener('click', this.myloader3);
        }
        if (document.getElementById('izbrisiDzokera')) {
            document.getElementById('izbrisiDzokera').removeEventListener('click', this.myloader4);
        }

        this.izbrisiEventeNaRadiouButtons()

        document.getElementById('pokreniIgru').removeEventListener('click', this.slotObject.pokreniOkretanjeSlotovaEvent);
        document.getElementById('game-button').removeEventListener('click', this.slotObject.tipIgreEvent);
        document.getElementById('bet-button').removeEventListener('click', this.slotObject.promeniBetIgreEvent);
        document.getElementById('game-button-nacin').removeEventListener('click', this.slotObject.promeniNacinNagradjivanjaEvent);
    }

    pokreniOkretanjeSlotova() {

        if (this.slotObject.brojKredita < this.getUkupanUlog(1)) {
            alert("nemate vise kredita, reloadujte stranicu")
        } else {
            this.pomocnikRotacije()
        }

    }

    pomocnikRotacije() {
        this.skiniListenere();
        
		this.rotateSlots([360, 360, 360, 360, 360])

        console.log('jjj', this.jokerAdded)

        

        if (this.slotObject.nag2.checked) {

            this.slotObject.brojkreditadiv.textContent = this.slotObject.brojKredita - this.slotObject.ulog

        } else {
            this.slotObject.brojkreditadiv.textContent = this.slotObject.brojKredita - (this.slotObject.ulog * this.brojacLinija() + this.vrednostDzokera)

        }
    }

    async postData(url = '', data = {}) {

        const response = await fetch(url, {
            method: 'POST',
            mode: 'same-origin',
            cache: 'no-cache',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    upisivacKredita(array) {

        if ((array[8] - array[7]) == this.slotObject.brojkreditadiv.textContent) {
            this.slotObject.brojKredita = array[8]
            this.slotObject.brojkreditadiv.textContent = array[8]
            document.getElementById('odSpin').textContent = this.slotObject.brojac
            if (array[7] > 0) {

                if (document.getElementsByClassName('ssss').length > 4) {
                    kombinacije.lastChild.remove();
                }

                let glDiv = document.createElement('div');
                glDiv.className = 'ssss';
                glDiv.style.cssText = 'display:flex; width:100%; margin-bottom:8px';

                let izvBrojev = document.createElement('div');
                izvBrojev.innerHTML = 'Izvučeni brojevi:<span>' + array[0] + ',' + array[1] + ',' + array[2] + ',' + array[3] + ',' + array[4] + '</span>';

                let ukUl = document.createElement('div');
                ukUl.innerHTML = 'Ukupan ulog: <span>' + this.slotObject.ukupanulog.textContent + ' $</span>';

                let tipNag = document.createElement('div');
                tipNag.innerHTML = 'Tip nagradjivanja:<span>' + document.querySelector('input[name="nag"]:checked').value + '</span>';

                let upOd = document.createElement('div');
                upOd.innerHTML = 'Odigrano Linija: <span>' + this.slotObject.igrabrojlinija.textContent + '</span>';

                let ukDob = document.createElement('div');
                ukDob.innerHTML = 'Ukupan dobitak: <span >' + array[7] + '</span> $';

                let glDiv2 = document.createElement('div');
                glDiv2.className = 'midMid'
                glDiv2.id = 'winwerDiv'
                glDiv2.style.cssText = 'padding: 4px; background: white; position: absolute; top: 0; right: 0; width: 100%; height: 100%; z-index: 100001;'

                let division = document.createElement('div');
                if (JSON.parse(array[5]).nacin == 1) {
                   
                        for (let i = 0; i < array[10].length; i++) {
                            if (array[10][i] !== "nema dobitka") {
                                division.innerHTML += '<h1>Svaka čast imate pogodak na liniji ' + (array[10][i][5] + 1) + ' </h1>'
                            }

                        }
                  

                    

                    
                } else {
                    division.innerHTML += '<h1>Svaka čast imate pogodak! </h1>'
                }
                division.innerHTML += '<h1>Vrhunska pobednička animacija</h1>'

                glDiv2.appendChild(division)

                if (array[9] === 0) {

                    let button1 = document.createElement('button');
                    button1.textContent = 'Pritisnite za nastavak igre'

                    button1.addEventListener('click', () => {

                        winwerDiv.remove()
                        document.getElementsByTagName("BODY")[0].style.overflow = 'initial'
                    });

                    glDiv2.appendChild(button1)

                } else {

                    glDiv2.innerHTML += '<h1> Ostvarili ste i pravo na mini game</h1>';

                    let button2 = document.createElement('button');
                    button2.textContent = 'Pritisnite za ulazak u mini game'

                    glDiv2.appendChild(button2)

                    button2.addEventListener('click', () => {

                        let glDiv3 = document.createElement('div');
                        glDiv3.className = 'midMid'
                        glDiv3.id = 'winwerDiv2'
                        glDiv3.style.cssText = 'padding: 4px; background: white; position: absolute; top: 0; right: 0; width: 100%; height: 100%; z-index: 100001;'
                        glDiv3.innerHTML = "<h1> Mini game nije nažalost spreman :'( </h1>";
                        glDiv2.appendChild(glDiv3)

                        let button3 = document.createElement('button');
                        button3.textContent = 'Pritisnite za nastavak igre'
                        glDiv3.appendChild(button3)
                        button3.addEventListener('click', () => {
                            winwerDiv.remove()
                            document.getElementsByTagName("BODY")[0].style.overflow = 'initial'

                        });

                    });

                }

                document.getElementsByTagName("BODY")[0].style.overflow = 'hidden'
                document.getElementsByTagName("BODY")[0].prepend(glDiv2);

                glDiv.appendChild(izvBrojev);
                glDiv.appendChild(ukUl);
                glDiv.appendChild(tipNag);
                glDiv.appendChild(upOd);
                glDiv.appendChild(ukDob);
                kombinacije.prepend(glDiv);

            }
        } else {

            this.slotObject.brojKredita = 0
            this.slotObject.brojkreditadiv.textContent = 0
            console.log('varate, zbog toga su vam oduzeti svi krediti')
        }

    }

}