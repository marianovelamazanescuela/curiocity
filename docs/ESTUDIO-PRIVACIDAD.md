# Versión de estudio de Curiocity: qué datos se recogen y qué se hace con ellos

Resumen en lenguaje llano, como base para el consentimiento de las familias. El detalle técnico está en el README, en la sección "Versión de estudio".

## Qué es
Curiocity es una app educativa: el niño o la niña hace una foto a un objeto cotidiano y la app le propone una pequeña lección sobre él.

Para el estudio piloto se usa una **versión de estudio**, con una dirección web propia. Esta versión anota cómo se usa la app, para saber si despierta la curiosidad y qué partes funcionan. La versión normal de la app no anota nada.

## Qué datos se recogen
Cada vez que el niño o la niña hace algo en la app, se anota:
- **qué ha hecho**: hacer una foto, elegir una asignatura, pasar de pantalla, responder la pregunta, hacer el reto, abrir un enlace…;
- **cuándo** lo ha hecho, y cuánto tiempo ha pasado en cada pantalla;
- **qué objeto y qué asignatura** estaba explorando (por ejemplo, "plátano · Biología") y si acertó la pregunta;
- **la lección que le mostró la app**, es decir, el texto escrito por la inteligencia artificial;
- **un código de participante**, por ejemplo `LINCE-47`.

## Qué NO se recoge nunca
- **Las fotos.** La foto se usa en ese momento para reconocer el objeto y no se guarda en ningún sitio, ni en el móvil para el estudio ni en el servidor.
- Ninguna otra imagen.
- El nombre del niño o la niña, ni ningún otro dato personal. Nadie escribe nada en la app.
- La ubicación.
- Datos del móvil: modelo, identificadores, dirección IP o navegador.

## El código de participante
- La app genera el código automáticamente la primera vez que se abre en un móvil, y el niño o la niña lo apunta en una hoja de papel.
- **La relación entre el código y el nombre solo está en ese papel**, que guarda el equipo investigador. En los datos solo aparece el código.
- Cada móvil lo usa un solo niño o niña durante el estudio.

## Dónde se guardan
1. **En el móvil, solo un momento.** Las anotaciones esperan en el móvil hasta que se envían. En cuanto llegan a su destino, se borran del móvil.
2. **Nuestro servidor** está alojado en Render, en Frankfurt (Alemania). Solo comprueba que los datos son correctos y los pasa a la hoja de cálculo: no guarda nada. No anota la dirección IP ni el navegador. Render, como cualquier servicio de alojamiento, lleva sus propios registros técnicos de acceso; esos no forman parte de los datos del estudio.
3. **Una hoja de cálculo de Google Drive del equipo investigador**, en la cuenta educativa oficial de la Consejería de la Junta de Andalucía (dominio `g.educaand.es`). Es el único sitio donde quedan los datos.
   - *Pendiente de confirmar:* que los datos de esa cuenta se guardan en la Unión Europea, según el contrato de la Consejería con Google. Se puede consultar con su delegado de protección de datos.

## Quién accede
- Solo el equipo investigador, a través de su cuenta de Google. La hoja no se comparte con nadie más.
- Nadie más puede escribir en ella: solo admite datos de nuestro servidor, que usa una clave secreta.

## Cuánto tiempo se guardan y cómo se borran
- Al terminar el estudio, el equipo investigador borra la hoja de cálculo y vacía la papelera de Google Drive.
- La versión de estudio de la app se da de baja.
- En los móviles basta con borrar los datos del navegador o desinstalar la app.
- Si una familia pide borrar los datos de su hijo o hija, se buscan en la hoja por su código y se borran esas filas.

## Para qué se usan
Solo para la investigación educativa sobre Curiocity, sobre si la app despierta la curiosidad, qué pantallas funcionan y cuáles no, y cuánto tiempo se usa. Los resultados se publican de forma agregada, sin códigos individuales.
