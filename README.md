# ClearDebt Agenda

Calendario personal de ingresos, facturas, comestibles y pagos de tarjetas. Incluye las nueve vistas del libro de planificación y trabaja en dólares, con importes almacenados en centavos.

## Abrir en el equipo

Con Node.js 22 instalado, abre PowerShell en esta carpeta y ejecuta lo siguiente.

```powershell
npm.cmd run dev
```

Abre **http://127.0.0.1:4178/**. La aplicación conserva los cambios automáticamente en `.local/plan.json`. La barra superior indica cuándo terminó la escritura. Si dos ventanas editan versiones diferentes, la segunda conserva sus cambios en pantalla para que puedas descargar su respaldo antes de recargar.

## Usar la agenda

- En **Mi semana**, elige la semana, pulsa un día y abre cualquier cobro, pago o factura para editar sus datos.
- **Envíos por tarjeta** reúne mínimos y abonos adicionales. **Vencimientos** permite confirmar el estado y registrar pagos acreditados. El plan utiliza el viernes anterior al vencimiento.
- **Plan mensual** y **Cada viernes** muestran apartados. **Caja diaria** calcula el efectivo tomando en cuenta el día del pago. El mínimo ya acreditado se descuenta del pendiente por enviar y se conserva como salida en la proyección.
- **Presupuesto**, **Gastos fijos** y **Tarjetas** contienen los datos de origen. Los cambios actualizan todas las vistas. Las casillas opcionales vacías representan información pendiente.
- En **Datos y respaldo** puedes descargar y restaurar un JSON. El archivo contiene tu información financiera.

## Publicación posterior en Vercel

El proyecto es independiente de la app de ClearDebt con Plaid. La inicialización local usa la copia importada del Excel. La aplicación lleva sus propios datos a partir de esa importación.

```powershell
npm.cmd test
npm.cmd run build
```

El comando de compilación copia exclusivamente los archivos de la interfaz a `dist/`. El archivo `vercel.json` configura el despliegue estático. Conserva `.local/`, las hojas Excel y los respaldos JSON en tu equipo, fuera del repositorio.

En la versión estática, el plan se guarda en el almacenamiento del navegador. Para trasladarlo, descarga un respaldo desde la agenda local y restáuralo en el dominio nuevo. Cada navegador o dispositivo administra su propia copia.

## Importación inicial de Excel

Esta instalación ya incluye el plan local. Para iniciar otra instalación vacía con el mismo formato de libro, el conversor opcional `scripts/from_excel.py` requiere Python y openpyxl. Recibe la ruta del archivo por argumento y crea el archivo privado solo si la instalación está vacía.
