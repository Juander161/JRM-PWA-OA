Attribute VB_Name = "modOrderApproval"
Option Explicit

'=====================================================================
' Order Approval — evaluación de solicitudes contra el reporte OH
'
' Port de las reglas de la PWA a VBA, para el caso en que no se autorice
' publicar una aplicación. Mismas reglas, mismos estados, mismos colores.
'
' Cada BO# se escribe en su propia hoja: las pestañas de Excel hacen el
' papel de las pestañas de la aplicación.
'
' MACROS QUE SE EJECUTAN A MANO:
'   ConfigurarLibro    · una sola vez, crea las hojas y los valores por defecto
'   EvaluarSolicitudes · el botón de todos los días
'   LimpiarResultados  · borra las hojas de BO# generadas
'=====================================================================

' --- Hojas fijas del libro ---
Private Const HOJA_CONFIG    As String = "Config"
Private Const HOJA_PEGAR     As String = "Pegar"
Private Const HOJA_OH        As String = "OH"
Private Const HOJA_HISTORIAL As String = "Historial"

' --- Colores de estado (mismos que la aplicación) ---
Private Const FONDO_APROBADO As Long = 15462884   ' #E4F2EA
Private Const FONDO_RECHAZADO As Long = 15263737  ' #F9E5E5
Private Const FONDO_REVISAR  As Long = 14344699   ' #FBEFDA
Private Const FONDO_NEUTRO   As Long = 16185837   ' #EDF0F6

' --- Estados ---
Private Const EST_APROBADO  As String = "Aprobado"
Private Const EST_RECHAZADO As String = "Rechazado"
Private Const EST_REVISAR   As String = "Revisar"
Private Const EST_SINDATO   As String = "Sin dato"
Private Const EST_SERVICIO  As String = "N/A - Servicio"

Private Type tItem
    Codigo          As String
    Qty             As Double
    Descripcion     As String
    Duplicados      As Long
    Disponible      As Double
    EnInventario    As Boolean
    Porcentaje      As Double
    TienePorcentaje As Boolean
    Estado          As String
    Motivo          As String
End Type

Private Type tSolicitud
    BO        As String
    RddTexto  As String
    Rdd       As Date
    RddValida As Boolean
    SinEncabezado As Boolean
    Cliente   As String
    Rep       As String
    Items()   As tItem
    NumItems  As Long
End Type

Private Type tConfig
    Umbral         As Double
    MargenDias     As Long
    MargenAmbar    As Double
    CantidadMaxima As Double
    CantidadMinima As Double
    Excluidos      As Object   ' Scripting.Dictionary
End Type


'=====================================================================
' 1 · INSTALACIÓN
'=====================================================================

Public Sub ConfigurarLibro()
    Dim h As Worksheet

    Application.ScreenUpdating = False

    Set h = ObtenerOCrearHoja(HOJA_CONFIG)
    If h.Range("A1").Value = "" Then
        With h
            .Range("A1").Value = "Parámetro":        .Range("B1").Value = "Valor"
            .Range("A2").Value = "Umbral (%)":       .Range("B2").Value = 30
            .Range("A3").Value = "Margen RDD (días)":.Range("B3").Value = 3
            .Range("A4").Value = "Zona ámbar (%)":   .Range("B4").Value = 7
            .Range("A5").Value = "Cantidad máxima":  .Range("B5").Value = 0
            .Range("A6").Value = "Cantidad mínima":  .Range("B6").Value = 0
            .Range("A8").Value = "Items excluidos (uno por fila, desde A9)"
            .Range("A1:B1").Font.Bold = True
            .Range("A8").Font.Bold = True
            .Columns("A").ColumnWidth = 32
            .Columns("B").ColumnWidth = 14
        End With
    End If

    Set h = ObtenerOCrearHoja(HOJA_PEGAR)
    If h.Range("A1").Value = "" Then
        h.Range("A1").Value = "Pega aquí el asunto y el cuerpo del correo, luego ejecuta EvaluarSolicitudes"
        h.Range("A1").Font.Bold = True
        h.Columns("A").ColumnWidth = 120
    End If

    Set h = ObtenerOCrearHoja(HOJA_OH)
    If h.Range("A1").Value = "" Then
        h.Range("A1").Value = "Item"
        h.Range("B1").Value = "Item Description"
        h.Range("C1").Value = "On-hand Qty"
        h.Range("A1:C1").Font.Bold = True
        h.Range("A2").Value = "(pega aquí el reporte OH, respetando los encabezados)"
    End If

    Set h = ObtenerOCrearHoja(HOJA_HISTORIAL)
    If h.Range("A1").Value = "" Then
        h.Range("A1:J1").Value = Array("Fecha", "Hora", "BO#", "Cliente", "Rep", _
                                       "Item", "Qty", "Disponible", "% consumo", "Estado")
        h.Range("A1:J1").Font.Bold = True
    End If

    Application.ScreenUpdating = True
    MsgBox "Libro configurado." & vbCrLf & vbCrLf & _
           "1. Pega el reporte en la hoja OH" & vbCrLf & _
           "2. Pega el correo en la hoja Pegar" & vbCrLf & _
           "3. Ejecuta EvaluarSolicitudes", vbInformation
End Sub


'=====================================================================
' 2 · MACRO PRINCIPAL
'=====================================================================

Public Sub EvaluarSolicitudes()
    Dim cfg As tConfig
    Dim inventario As Object
    Dim solicitudes() As tSolicitud
    Dim numSolicitudes As Long
    Dim i As Long

    On Error GoTo Fallo
    Application.ScreenUpdating = False

    cfg = LeerConfig()
    Set inventario = LeerInventario()

    If inventario.Count = 0 Then
        Application.ScreenUpdating = True
        MsgBox "La hoja " & HOJA_OH & " está vacía o no tiene las columnas " & _
               "'Item' y 'On-hand Qty'.", vbExclamation
        Exit Sub
    End If

    numSolicitudes = ParsearTexto(LeerTextoPegado(), solicitudes)

    If numSolicitudes = 0 Then
        Application.ScreenUpdating = True
        MsgBox "No se encontró ninguna solicitud en la hoja " & HOJA_PEGAR & ".", vbExclamation
        Exit Sub
    End If

    For i = 1 To numSolicitudes
        EvaluarUnaSolicitud solicitudes(i), inventario, cfg
        EscribirHoja solicitudes(i)
        RegistrarEnHistorial solicitudes(i)
    Next i

    Application.ScreenUpdating = True
    MsgBox numSolicitudes & " solicitud(es) evaluada(s)." & vbCrLf & _
           "Cada BO# quedó en su propia pestaña.", vbInformation
    Exit Sub

Fallo:
    Application.ScreenUpdating = True
    MsgBox "Error " & Err.Number & ": " & Err.Description, vbCritical
End Sub


Public Sub LimpiarResultados()
    Dim h As Worksheet
    Dim n As Long

    If MsgBox("¿Borrar todas las pestañas de resultados?" & vbCrLf & _
              "Config, Pegar, OH e Historial no se tocan.", _
              vbQuestion + vbYesNo) <> vbYes Then Exit Sub

    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    For Each h In ThisWorkbook.Worksheets
        If Not EsHojaFija(h.Name) Then
            h.Delete
            n = n + 1
        End If
    Next h
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True

    MsgBox n & " pestaña(s) eliminada(s).", vbInformation
End Sub


'=====================================================================
' 3 · CONFIGURACIÓN E INVENTARIO
'=====================================================================

Private Function LeerConfig() As tConfig
    Dim h As Worksheet, f As Long, codigo As String

    Set h = ThisWorkbook.Worksheets(HOJA_CONFIG)

    LeerConfig.Umbral = Val(h.Range("B2").Value) / 100
    LeerConfig.MargenDias = CLng(Val(h.Range("B3").Value))
    LeerConfig.MargenAmbar = Val(h.Range("B4").Value) / 100
    LeerConfig.CantidadMaxima = Val(h.Range("B5").Value)
    LeerConfig.CantidadMinima = Val(h.Range("B6").Value)

    Set LeerConfig.Excluidos = CreateObject("Scripting.Dictionary")
    f = 9
    Do While Trim(h.Cells(f, 1).Value) <> ""
        codigo = UCase(Trim(h.Cells(f, 1).Value))
        If Not LeerConfig.Excluidos.Exists(codigo) Then LeerConfig.Excluidos.Add codigo, True
        f = f + 1
    Loop
End Function


' Devuelve un diccionario código -> Array(disponible, descripción).
' Si un item aparece en varias filas (distintos Locators), se SUMAN las
' cantidades: quedarse con la primera daría un disponible menor al real.
Private Function LeerInventario() As Object
    Dim h As Worksheet
    Dim colItem As Long, colQty As Long, colDesc As Long
    Dim ultimaFila As Long, f As Long
    Dim codigo As String, cantidad As Double
    Dim datos As Variant

    Set LeerInventario = CreateObject("Scripting.Dictionary")
    Set h = ThisWorkbook.Worksheets(HOJA_OH)

    colItem = BuscarColumna(h, Array("ITEM", "CODIGO", "ITEM CODE"))
    colQty = BuscarColumna(h, Array("ON-HAND QTY", "ON HAND QTY", "ONHAND QTY", _
                                    "OH QTY", "DISPONIBLE", "CANTIDAD DISPONIBLE"))
    colDesc = BuscarColumna(h, Array("ITEM DESCRIPTION", "DESCRIPCION", "DESCRIPTION"))
    If colItem = 0 Or colQty = 0 Then Exit Function

    ultimaFila = h.Cells(h.Rows.Count, colItem).End(xlUp).Row

    For f = 2 To ultimaFila
        codigo = UCase(Trim(CStr(h.Cells(f, colItem).Value)))
        If codigo <> "" Then
            cantidad = Val(h.Cells(f, colQty).Value)
            If LeerInventario.Exists(codigo) Then
                datos = LeerInventario(codigo)
                datos(0) = datos(0) + cantidad
                LeerInventario(codigo) = datos
            Else
                Dim desc As String
                desc = ""
                If colDesc > 0 Then desc = Trim(CStr(h.Cells(f, colDesc).Value))
                LeerInventario.Add codigo, Array(cantidad, desc)
            End If
        End If
    Next f
End Function


'=====================================================================
' 4 · PARSEO DEL TEXTO
'=====================================================================

' Reconstruye el texto pegado, una línea por fila.
'
' Al pegar, Excel puede repartir cada renglón en varias columnas: recuerda el
' último delimitador usado en "Texto en columnas" y lo aplica a lo que se
' pegue después. Leer solo la columna A perdería el Qty y la descripción, así
' que se recorre la fila completa y se vuelve a unir.
'
' El separador depende del renglón: el encabezado PRDF va separado por comas
' —el patrón las necesita para distinguir los campos— y los renglones de
' artículo por espacios.
Private Function LeerTextoPegado() As String
    Dim h As Worksheet
    Dim ultimaFila As Long, ultimaCol As Long
    Dim f As Long, c As Long
    Dim linea As String, celda As String, separador As String
    Dim sb As String

    Dim ultima As Range

    Set h = ThisWorkbook.Worksheets(HOJA_PEGAR)

    Set ultima = h.Cells.Find("*", , xlValues, , xlByRows, xlPrevious)
    If ultima Is Nothing Then Exit Function
    ultimaFila = ultima.Row

    Set ultima = h.Cells.Find("*", , xlValues, , xlByColumns, xlPrevious)
    ultimaCol = ultima.Column
    ' Tope de seguridad: si quedó basura muy a la derecha, no tiene sentido
    ' recorrer cientos de columnas por cada renglón.
    If ultimaCol > 40 Then ultimaCol = 40

    For f = 2 To ultimaFila
        If UCase(Left(Trim(CStr(h.Cells(f, 1).Value)), 4)) = "PRDF" Then
            separador = ", "
        Else
            separador = " "
        End If

        linea = ""
        For c = 1 To ultimaCol
            celda = Trim(CStr(h.Cells(f, c).Value))
            If celda <> "" Then
                If linea = "" Then
                    linea = celda
                Else
                    linea = linea & separador & celda
                End If
            End If
        Next c

        If linea <> "" Then sb = sb & linea & vbLf
    Next f

    LeerTextoPegado = sb
End Function


' Une los renglones cuya descripción quedó abierta: cuando el cliente de
' correo envuelve una descripción larga, ninguna de las dos líneas encaja
' con el patrón y el artículo se perdería sin evaluar.
Private Function UnirLineasDeItem(lineas As Variant) As Variant
    Dim unidas() As String
    Dim i As Long, n As Long
    Dim linea As String, posDesc As Long

    ReDim unidas(LBound(lineas) To UBound(lineas))
    i = LBound(lineas)

    Do While i <= UBound(lineas)
        linea = lineas(i)
        posDesc = InStr(1, linea, "Description [", vbTextCompare)
        If posDesc > 0 Then
            Do While InStr(posDesc, linea, "]") = 0 And i < UBound(lineas)
                i = i + 1
                linea = linea & " " & Trim(lineas(i))
            Loop
        End If
        unidas(n) = linea
        n = n + 1
        i = i + 1
    Loop

    ReDim Preserve unidas(0 To IIf(n = 0, 0, n - 1))
    UnirLineasDeItem = unidas
End Function


Private Function ParsearTexto(texto As String, ByRef solicitudes() As tSolicitud) As Long
    Dim reEncabezado As Object, reItem As Object
    Dim coincidencias As Object
    Dim lineas As Variant, linea As Variant
    Dim n As Long, actual As Long

    Set reEncabezado = CreateObject("VBScript.RegExp")
    reEncabezado.Pattern = "PRDF:\s*RDD\s*([^,]+),\s*Event Date\s*([^,]+),\s*(.+?),\s*Rep\s+(.+?),\s*BO#\s*(\S+)"
    reEncabezado.IgnoreCase = True

    Set reItem = CreateObject("VBScript.RegExp")
    reItem.Pattern = "Item\s*\[([^\]]*)\]\s*Qty\s*\[([^\]]*)\]\s*Description\s*\[([^\]]*)\]"
    reItem.IgnoreCase = True

    ' Se reserva poco y se crece según haga falta. Reservar de golpe para
    ' cientos de solicitudes con cientos de items cada una son decenas de
    ' miles de estructuras, y VBA se queda sin pila (Error 28).
    ReDim solicitudes(1 To 8)
    lineas = UnirLineasDeItem(Split(Replace(texto, vbCrLf, vbLf), vbLf))

    For Each linea In lineas
        linea = Trim(linea)
        If linea <> "" Then

            If reEncabezado.Test(CStr(linea)) Then
                Set coincidencias = reEncabezado.Execute(CStr(linea))
                n = n + 1
                If n > UBound(solicitudes) Then
                    ReDim Preserve solicitudes(1 To UBound(solicitudes) * 2)
                End If
                actual = n
                With solicitudes(actual)
                    .RddTexto = Trim(coincidencias(0).SubMatches(0))
                    .Cliente = Trim(coincidencias(0).SubMatches(2))
                    .Rep = Trim(coincidencias(0).SubMatches(3))
                    .BO = Trim(coincidencias(0).SubMatches(4))
                    .SinEncabezado = False
                    .Rdd = ConvertirRdd(.RddTexto, .RddValida)
                    .NumItems = 0
                    ReDim .Items(1 To 8)
                End With

            ElseIf reItem.Test(CStr(linea)) Then
                ' Items sin encabezado previo: solicitud sintética, sin RDD.
                If actual = 0 Then
                    n = n + 1
                    If n > UBound(solicitudes) Then
                        ReDim Preserve solicitudes(1 To UBound(solicitudes) * 2)
                    End If
                    actual = n
                    With solicitudes(actual)
                        .BO = "(sin encabezado)"
                        .SinEncabezado = True
                        .RddValida = False
                        .NumItems = 0
                        ReDim .Items(1 To 8)
                    End With
                End If

                Set coincidencias = reItem.Execute(CStr(linea))
                AgregarItem solicitudes(actual), _
                    Trim(coincidencias(0).SubMatches(0)), _
                    Val(Trim(coincidencias(0).SubMatches(1))), _
                    Trim(coincidencias(0).SubMatches(2))
            End If

        End If
    Next linea

    ParsearTexto = n
End Function


' Un mismo código repetido dentro de la solicitud suma su cantidad, en vez
' de quedar como dos renglones sueltos.
Private Sub AgregarItem(ByRef s As tSolicitud, codigo As String, qty As Double, desc As String)
    Dim i As Long

    For i = 1 To s.NumItems
        If UCase(s.Items(i).Codigo) = UCase(codigo) Then
            s.Items(i).Qty = s.Items(i).Qty + qty
            s.Items(i).Duplicados = s.Items(i).Duplicados + 1
            Exit Sub
        End If
    Next i

    If s.NumItems + 1 > UBound(s.Items) Then
        ReDim Preserve s.Items(1 To UBound(s.Items) * 2)
    End If

    s.NumItems = s.NumItems + 1
    With s.Items(s.NumItems)
        .Codigo = codigo
        .Qty = qty
        .Descripcion = desc
        .Duplicados = 1
    End With
End Sub


Private Function ConvertirRdd(texto As String, ByRef valida As Boolean) As Date
    Dim partes As Variant, mes As Long, anio As Long

    valida = False
    partes = Split(Trim(texto), "-")
    If UBound(partes) <> 2 Then Exit Function

    Select Case UCase(Trim(partes(1)))
        Case "JAN", "ENE": mes = 1
        Case "FEB":        mes = 2
        Case "MAR":        mes = 3
        Case "APR", "ABR": mes = 4
        Case "MAY":        mes = 5
        Case "JUN":        mes = 6
        Case "JUL":        mes = 7
        Case "AUG", "AGO": mes = 8
        Case "SEP":        mes = 9
        Case "OCT":        mes = 10
        Case "NOV":        mes = 11
        Case "DEC", "DIC": mes = 12
        Case Else:         Exit Function
    End Select

    anio = Val(partes(2))
    If anio < 100 Then anio = anio + 2000

    On Error GoTo SalirSinFecha
    ConvertirRdd = DateSerial(anio, mes, Val(partes(0)))
    valida = True
    Exit Function

SalirSinFecha:
End Function


'=====================================================================
' 5 · REGLAS DE NEGOCIO
'
' Orden de prioridad idéntico al de la aplicación. Si aquí se cambia algo
' y allá no (o al revés), los dos dejan de coincidir.
'=====================================================================

Private Function EsItemServicio(descripcion As String) As Boolean
    Dim re As Object
    Set re = CreateObject("VBScript.RegExp")
    re.Pattern = "^(SERVICE|FREIGHT|HANDLING|SETUP|MISCELLANEOUS|PACKAGING|PRODUCT\s+PACKAGE)\s*[:\-]"
    re.IgnoreCase = True
    EsItemServicio = re.Test(Trim(descripcion))
End Function


Private Sub EvaluarUnaSolicitud(ByRef s As tSolicitud, inventario As Object, cfg As tConfig)
    Dim i As Long, dias As Long
    Dim codigo As String, datos As Variant
    Dim rddEnRiesgo As Boolean, rddNoLegible As Boolean

    rddNoLegible = (Not s.SinEncabezado) And (Not s.RddValida)
    rddEnRiesgo = False
    If s.RddValida Then
        dias = DateDiff("d", Date, s.Rdd)
        rddEnRiesgo = (dias < cfg.MargenDias)
    End If

    For i = 1 To s.NumItems
        With s.Items(i)
            codigo = UCase(.Codigo)
            .EnInventario = inventario.Exists(codigo)
            .TienePorcentaje = False
            .Motivo = ""

            If .EnInventario Then
                datos = inventario(codigo)
                .Disponible = datos(0)
            End If

            If cfg.Excluidos.Exists(codigo) Then
                .Estado = EST_RECHAZADO
                .Motivo = "Item en lista de exclusión de reglas"

            ElseIf cfg.CantidadMaxima > 0 And .Qty > cfg.CantidadMaxima Then
                .Estado = EST_RECHAZADO
                .Motivo = "Cantidad (" & .Qty & ") supera el máximo configurado (" & cfg.CantidadMaxima & ")"

            ElseIf cfg.CantidadMinima > 0 And .Qty < cfg.CantidadMinima Then
                .Estado = EST_RECHAZADO
                .Motivo = "Cantidad (" & .Qty & ") por debajo del mínimo configurado (" & cfg.CantidadMinima & ")"

            ElseIf rddNoLegible Then
                .Estado = EST_REVISAR
                .Motivo = "No se pudo interpretar la fecha RDD (""" & s.RddTexto & """); confirmar a mano"

            ElseIf rddEnRiesgo Then
                .Estado = EST_RECHAZADO
                .Motivo = "RDD a " & dias & " día(s) (mínimo requerido: " & cfg.MargenDias & ")"

            ElseIf Not .EnInventario Then
                If EsItemServicio(.Descripcion) Then
                    .Estado = EST_SERVICIO
                    .Motivo = "Item de servicio o paquete — no tiene entrada en el OH"
                Else
                    .Estado = EST_SINDATO
                    .Motivo = "Item no encontrado en el reporte de disponibilidad"
                End If

            ElseIf .Disponible < 0 Then
                ' Antes del cálculo de porcentaje: dividir entre un negativo
                ' da un porcentaje negativo que, por ser menor al umbral,
                ' pasaría como Aprobado — justo al revés de la realidad.
                If EsItemServicio(.Descripcion) Then
                    .Estado = EST_SERVICIO
                    .Motivo = "Disponible negativo (" & .Disponible & ") — esperado en items de servicio o paquete"
                Else
                    .Estado = EST_RECHAZADO
                    .Motivo = "Disponible negativo (" & .Disponible & ") en el OH: no hay material y el dato indica un error de inventario"
                End If

            ElseIf .Disponible = 0 Then
                .Estado = EST_RECHAZADO
                .Motivo = "Cantidad disponible es 0"

            Else
                .Porcentaje = .Qty / .Disponible
                .TienePorcentaje = True

                If .Porcentaje >= cfg.Umbral Then
                    .Estado = EST_RECHAZADO
                    .Motivo = "Consumo " & Format(.Porcentaje, "0.0%") & " supera el umbral (" & Format(cfg.Umbral, "0%") & ")"
                ElseIf cfg.MargenAmbar > 0 And .Porcentaje >= (cfg.Umbral - cfg.MargenAmbar) Then
                    .Estado = EST_REVISAR
                    .Motivo = "Consumo " & Format(.Porcentaje, "0.0%") & " está cerca del umbral; revisar antes de aprobar"
                Else
                    .Estado = EST_APROBADO
                End If
            End If
        End With
    Next i
End Sub


Private Function EstadoGeneral(s As tSolicitud) As String
    Dim i As Long, hayRevisar As Boolean, haySinDato As Boolean

    For i = 1 To s.NumItems
        Select Case s.Items(i).Estado
            Case EST_RECHAZADO: EstadoGeneral = EST_RECHAZADO: Exit Function
            Case EST_REVISAR:   hayRevisar = True
            Case EST_SINDATO:   haySinDato = True
        End Select
    Next i

    If hayRevisar Then
        EstadoGeneral = EST_REVISAR
    ElseIf haySinDato Then
        EstadoGeneral = EST_SINDATO
    Else
        EstadoGeneral = EST_APROBADO
    End If
End Function


'=====================================================================
' 6 · SALIDA
'=====================================================================

Private Sub EscribirHoja(s As tSolicitud)
    Dim h As Worksheet
    Dim i As Long, fila As Long
    Dim nombre As String

    nombre = LimpiarNombreHoja(s.BO)

    Application.DisplayAlerts = False
    On Error Resume Next
    ThisWorkbook.Worksheets(nombre).Delete
    On Error GoTo 0
    Application.DisplayAlerts = True

    Set h = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
    h.Name = nombre

    With h
        .Range("A1").Value = "BO# " & s.BO
        .Range("A1").Font.Size = 14
        .Range("A1").Font.Bold = True

        .Range("A2").Value = "Cliente:"  : .Range("B2").Value = s.Cliente
        .Range("A3").Value = "Rep:"      : .Range("B3").Value = s.Rep
        .Range("A4").Value = "RDD:"      : .Range("B4").Value = s.RddTexto
        .Range("A5").Value = "Estado:"   : .Range("B5").Value = EstadoGeneral(s)
        .Range("A2:A5").Font.Bold = True
        .Range("B5").Font.Bold = True
        .Range("B5").Interior.Color = ColorDeEstado(EstadoGeneral(s))

        .Range("A7:G7").Value = Array("Item", "Descripción", "Qty solicitada", _
                                      "Disponible", "% consumo", "Estado", "Motivo")
        .Range("A7:G7").Font.Bold = True
        .Range("A7:G7").Interior.Color = FONDO_NEUTRO

        fila = 8
        For i = 1 To s.NumItems
            With s.Items(i)
                h.Cells(fila, 1).Value = "'" & .Codigo
                h.Cells(fila, 2).Value = .Descripcion
                h.Cells(fila, 3).Value = .Qty
                If .EnInventario Then h.Cells(fila, 4).Value = .Disponible Else h.Cells(fila, 4).Value = "—"
                If .TienePorcentaje Then
                    h.Cells(fila, 5).Value = .Porcentaje
                    h.Cells(fila, 5).NumberFormat = "0.0%"
                Else
                    h.Cells(fila, 5).Value = "—"
                End If
                h.Cells(fila, 6).Value = .Estado
                h.Cells(fila, 6).Interior.Color = ColorDeEstado(.Estado)
                h.Cells(fila, 7).Value = .Motivo
            End With
            fila = fila + 1
        Next i

        .Columns("A").ColumnWidth = 14
        .Columns("B").ColumnWidth = 52
        .Columns("C:E").ColumnWidth = 13
        .Columns("F").ColumnWidth = 15
        .Columns("G").ColumnWidth = 60
        .Range("A7:G" & fila - 1).Borders.LineStyle = xlContinuous
        .Range("A7:G" & fila - 1).Borders.Color = RGB(200, 205, 215)
        .Rows(8).Select
        ActiveWindow.FreezePanes = False
    End With
End Sub


Private Sub RegistrarEnHistorial(s As tSolicitud)
    Dim h As Worksheet, fila As Long, i As Long

    Set h = ThisWorkbook.Worksheets(HOJA_HISTORIAL)
    fila = h.Cells(h.Rows.Count, 1).End(xlUp).Row + 1

    For i = 1 To s.NumItems
        With s.Items(i)
            h.Cells(fila, 1).Value = Date
            h.Cells(fila, 2).Value = Time
            h.Cells(fila, 3).Value = "'" & s.BO
            h.Cells(fila, 4).Value = s.Cliente
            h.Cells(fila, 5).Value = s.Rep
            h.Cells(fila, 6).Value = "'" & .Codigo
            h.Cells(fila, 7).Value = .Qty
            If .EnInventario Then h.Cells(fila, 8).Value = .Disponible
            If .TienePorcentaje Then h.Cells(fila, 9).Value = .Porcentaje
            h.Cells(fila, 10).Value = .Estado
        End With
        fila = fila + 1
    Next i
End Sub


'=====================================================================
' 7 · AUXILIARES
'=====================================================================

Private Function ColorDeEstado(estado As String) As Long
    Select Case estado
        Case EST_APROBADO:  ColorDeEstado = FONDO_APROBADO
        Case EST_RECHAZADO: ColorDeEstado = FONDO_RECHAZADO
        Case EST_REVISAR:   ColorDeEstado = FONDO_REVISAR
        Case Else:          ColorDeEstado = FONDO_NEUTRO
    End Select
End Function


Private Function EsHojaFija(nombre As String) As Boolean
    EsHojaFija = (nombre = HOJA_CONFIG Or nombre = HOJA_PEGAR Or _
                  nombre = HOJA_OH Or nombre = HOJA_HISTORIAL)
End Function


Private Function LimpiarNombreHoja(nombre As String) As String
    Dim invalidos As Variant, i As Long
    invalidos = Array("\", "/", ":", "*", "?", "[", "]")
    LimpiarNombreHoja = nombre
    For i = LBound(invalidos) To UBound(invalidos)
        LimpiarNombreHoja = Replace(LimpiarNombreHoja, invalidos(i), "_")
    Next i
    LimpiarNombreHoja = Left(Trim(LimpiarNombreHoja), 31)
    If LimpiarNombreHoja = "" Then LimpiarNombreHoja = "SIN_BO"
End Function


Private Function ObtenerOCrearHoja(nombre As String) As Worksheet
    On Error Resume Next
    Set ObtenerOCrearHoja = ThisWorkbook.Worksheets(nombre)
    On Error GoTo 0
    If ObtenerOCrearHoja Is Nothing Then
        Set ObtenerOCrearHoja = ThisWorkbook.Worksheets.Add( _
            After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ObtenerOCrearHoja.Name = nombre
    End If
End Function


Private Function BuscarColumna(h As Worksheet, candidatos As Variant) As Long
    Dim c As Long, encabezado As String, i As Long

    For c = 1 To 60
        encabezado = UCase(Trim(CStr(h.Cells(1, c).Value)))
        If encabezado <> "" Then
            For i = LBound(candidatos) To UBound(candidatos)
                If encabezado = candidatos(i) Then
                    BuscarColumna = c
                    Exit Function
                End If
            Next i
        End If
    Next c
End Function
