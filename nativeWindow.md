native-384-window trong app của mình chỉ có nghĩa là:

cửa sổ app được vẽ đúng kích thước gốc 384x384, tức đúng bằng số pixel thật của biển LED.

Nó không phải là một khái niệm “hệ điều hành native” gì đặc biệt. Nó chỉ là tên mode mình đặt để nhấn mạnh: “vẽ đúng bằng độ phân giải thật của biển”.

Hiểu bản chất bằng 3 lớp
Có 3 “thế giới pixel” khác nhau:

Pixel của nội dung app
Đây là cái bạn thiết kế: đồng hồ, logo, text, icon.

Pixel của tín hiệu HDMI mà máy tính xuất ra
Ví dụ Windows đang xuất 1920x1080.

Pixel vật lý thật của màn LED
Trường hợp của bạn là 384x384.

Bản chất vấn đề là:
3 lớp này không tự động giống nhau.

Ví dụ trừu tượng dễ hiểu
Hãy tưởng tượng:

App của bạn là một bức tranh.
HDMI là tờ giấy mà máy tính in bức tranh đó ra.
NovaStar là người cắt, co, dán bức tranh lên một bảng gạch LED.
Màn LED là bức tường có đúng 384x384 viên gạch phát sáng.
Nếu bức tranh gốc của bạn cũng đúng 384x384, và NovaStar dán thẳng từng ô vào từng viên gạch, thì đó là 1:1 pixel, nét nhất.

Nếu máy tính lại đưa cho NovaStar một tờ giấy 1920x1080, mà tường chỉ có 384x384 viên gạch, thì NovaStar buộc phải làm một trong các việc sau:

co nhỏ toàn bộ ảnh
cắt bớt ảnh
thêm viền đen
hoặc bóp méo để nhét vừa
Không có phép màu nào để 1920x1080 tự biến thành 384x384 mà vẫn “đầy màn, đúng tỷ lệ, và giữ nguyên từng pixel”.

NovaStar thực sự làm gì
Về bản chất, NovaStar VC4 là một bộ “phiên dịch + phân phối” tín hiệu hình ảnh.

Luồng đi như sau:

Máy tính render app thành hình ảnh.
GPU của máy tính ghép app đó vào desktop tổng và xuất qua HDMI.
Qua HDMI, máy tính gửi từng frame video sang NovaStar.
NovaStar nhận frame đó vào bộ nhớ.
NovaStar quyết định:
lấy vùng nào của frame
có scale hay không
có crop hay không
rồi map pixel nào tới LED nào
Sau đó NovaStar chia dữ liệu ra các card nhận trên từng cabinet/module LED.
Các card nhận điều khiển đèn LED sáng theo đúng dữ liệu đó.
Nói ngắn gọn:
PC tạo ảnh
-> HDMI gửi ảnh
-> NovaStar xử lý ảnh
-> LED hiển thị ảnh

Điểm cực quan trọng
NovaStar không “hiểu app Electron” hay “hiểu layout”.
Nó chỉ thấy một khung hình video đầu vào.

Nó không biết đâu là logo, đâu là đồng hồ. Nó chỉ biết:

đây là frame 1920x1080 hoặc 384x384
lấy vùng nào
co như thế nào
đẩy xuống LED ra sao
Vì sao màn LED 384x384 nhưng PC vẫn có thể thấy 1920x1080
Đây là chỗ dễ gây nhầm nhất.

Thiết bị NovaStar thường nói với máy tính:
“Anh cứ gửi cho tôi tín hiệu video chuẩn như 1920x1080@60Hz.”

Máy tính nghe vậy nên coi NovaStar như một màn hình 1080p.
Nhưng màn LED thật phía sau lại chỉ có 384x384.

Tức là:

1920x1080 là kích thước tín hiệu video đầu vào
384x384 là độ phân giải hiển thị thật của bảng LED
Hai cái này có thể khác nhau hoàn toàn.

native-384-window nghĩa là gì trong bối cảnh đó
Mode này nghĩa là app của bạn chỉ vẽ một cửa sổ đúng 384x384.

Lúc này có 2 khả năng:

Nếu Windows/NovaStar cũng đang làm việc đúng theo vùng 384x384, thì hình sẽ nét 1:1.
Nếu HDMI vẫn là 1920x1080, thì cửa sổ 384x384 chỉ là một ô vuông nhỏ nằm trong khung 1080p lớn. Muốn nó ra đúng LED, NovaStar phải được cấu hình lấy đúng ô vuông đó.
Nói dễ hiểu:
native-384-window không đảm bảo tự fill màn.
Nó đảm bảo app của bạn đang vẽ đúng “bản gốc chuẩn”.

Còn fullscreen là gì
Fullscreen nghĩa là app chiếm toàn bộ khung mà Windows đang thấy, ví dụ 1920x1080.

Khi đó NovaStar thường sẽ lấy cả khung đó rồi scale xuống LED 384x384.

Kết quả:

dễ đầy màn hơn
nhưng không còn chắc là đúng 1:1 pixel
và vì 1920x1080 là hình chữ nhật còn 384x384 là hình vuông, còn có nguy cơ crop, méo, hoặc viền đen
Cho nên:
fullscreen và đúng pixel là hai mục tiêu khác nhau.

Ví dụ rất đời thường
Ví dụ bạn có một bảng pegboard 384x384 lỗ.

Cách đúng nhất là bạn chuẩn bị sẵn một bản thiết kế cũng 384x384 lỗ.
Cách kém chính xác hơn là bạn in một poster 1920x1080 rồi nhờ ai đó ép nhỏ lại cho vừa bảng.
Cách 2 vẫn “đầy bảng”, nhưng chi tiết nhỏ sẽ không còn chuẩn như cách 1.

Áp vào màn của bạn
Mỗi module là 64x32.
Tổng màn là 384x384.

Suy ra:

ngang: 384 / 64 = 6 module
dọc: 384 / 32 = 12 module
Tức là màn thật của bạn có đúng 147,456 pixel LED.

Mục tiêu pixel-perfect là:
1 pixel trong app = 1 pixel LED thật

Đó là lý do mình thiên về:

thiết kế UI theo 384x384
chạy native-384-window
Windows scale 100%
NovaStar map đúng vùng 384x384
Câu chốt quan trọng nhất
Bạn đừng nghĩ theo kiểu:

“App đúng 384x384 thì chắc chắn sang LED sẽ tự full.”

Đúng hơn phải nghĩ là:

“App đúng 384x384 mới chỉ là làm đúng bản gốc.
Muốn ra LED đúng nữa thì Windows output, HDMI timing, NovaStar mapping, và scaling đều phải đúng.”

Nếu bạn muốn, mình có thể vẽ tiếp cho bạn một sơ đồ cực dễ hiểu kiểu:

App 384x384
-> Desktop 1920x1080
-> NovaStar crop vùng 384x384
-> LED 384x384

và một sơ đồ đối chiếu với case fullscreen để bạn nhìn là hiểu ngay khác nhau ở đâu.
