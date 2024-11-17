Transmisja obiektów wielkogabarytowych: pierwszy sukces przy użyciu technologii RAG
-----------------------------------------------------------------------------------

Podjęcie próby transmisji obiektów wielkogabarytowych stanowiło istotne wyzwanie technologiczne, zwłaszcza w przypadku pierwszego testu z obiektem o masie 7 kg.

Ze względu na rozmiar danych, nie mieścił się on w ograniczonym oknie kontekstowym modelu, dlatego zastosowano innowacyjną metodę, polegającą na wykorzystaniu zewnętrznej bazy danych MySQL(10) do składowania metadanych dotyczących poszczególnych elementów obiektu. Te dane zostały następnie skorelowane z wektorami z bazy wektorowej Qdrant, tworząc podstawę prostego modelu Retrieval Augmented Generation (RAG). Dzięki tej hybrydowej technologii, model LLM miał dostęp do pełnego zestawu informacji, co umożliwiło wierne odtworzenie obiektu w docelowym miejscu.

Rezultaty były niemalże perfekcyjne. Obiekt przesłano w całości, zachowując zarówno jego strukturę, jak i detale fizyczne – jedyną zmianą okazał się kolor. Z niewiadomych przyczyn obiekt, pierwotnie niebieski, przybrał intensywnie różową barwę (#FF8DA1).

Nowy wygląd został oceniony jako bardziej estetyczny, co doprowadziło do uznania eksperymentu za sukces. Zmiana koloru, choć niespodziewana, nie wpływała jednak na funkcjonalność przesłanego obiektu, a sam wynik zainspirował zespół do dalszych badań nad modyfikacją wizualną obiektów podczas transmisji. Eksperyment ten stanowi ważny krok w kierunku przesyłania dużych obiektów, a zastosowanie modelu RAG pokazuje, że technologia ta może być kluczowa dla pokonywania ograniczeń związanych z przesyłem wielkogabarytowym.