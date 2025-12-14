import { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import headerImg from "../assets/img/header-img.png"; // Изображение студента или учебной темы
import { ArrowRightCircle } from 'react-bootstrap-icons';
import 'animate.css';
import TrackVisibility from 'react-on-screen';

export const Banner = () => {
  const [loopNum, setLoopNum] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [text, setText] = useState('');
  const [delta, setDelta] = useState(100); // Ускоряем появление текста
  const [index, setIndex] = useState(1);
  const toRotate = ["Тебе нужна помощь?", "У тебя нет времени?", "Ты ничего не умеешь?"];
  const period = 3000; // Увеличиваем паузу перед удалением

  useEffect(() => {
    let ticker = setInterval(() => {
      tick();
    }, delta);

    return () => {
      clearInterval(ticker);
    };
  }, [text, delta]);

  const tick = () => {
    let i = loopNum % toRotate.length;
    let fullText = toRotate[i];
    let updatedText = isDeleting
      ? fullText.substring(0, text.length - 1)
      : fullText.substring(0, text.length + 1);

    setText(updatedText);

    if (isDeleting) {
      setDelta(200); // Замедляем удаление текста
    }

    if (!isDeleting && updatedText === fullText) {
      setIsDeleting(true);
      setIndex((prevIndex) => prevIndex - 1);
      setDelta(period); // Пауза перед началом удаления
    } else if (isDeleting && updatedText === '') {
      setIsDeleting(false);
      setLoopNum(loopNum + 1);
      setIndex(1);
      setDelta(100); // Ускоряем появление следующего текста
    } else {
      setIndex((prevIndex) => prevIndex + 1);
    }
  };

  return (
    <section className="banner" id="home">
      <Container>
        <Row className="align-items-center">
          <Col xs={12} md={6} xl={7}>
            <TrackVisibility>
              {({ isVisible }) => (
                <div className={isVisible ? "animate__animated animate__fadeIn" : ""}>
                  <span className="tagline">Добро пожаловать!</span>
                  <h1>
                    {`Привет! `}{' '}
                    <span
                      className="txt-rotate"
                      data-period="1000"
                      data-rotate='["Тебе нужна помощь?", "У тебя нет времени?", "Ты ничего не умеешь?"]'
                    >
                      <span className="wrap">{text}</span>
                    </span>
                  </h1>
                  <p>
                    Мы можем помочь тебе, так как увлечены веб-разработкой и созданием удобных интерфейсов. Здесь вы
                    найдете учебные проекты, выполненные в рамках курсовых проектов, а также
                    примеры наших навыков программирования и дизайна.
                  </p>
                  <button onClick={() => console.log('connect')}>
                    Связаться с нами <ArrowRightCircle size={25} />
                  </button>
                </div>
              )}
            </TrackVisibility>
          </Col>
          <Col xs={12} md={6} xl={5}>
            <TrackVisibility>
              {({ isVisible }) => (
                <div className={isVisible ? "animate__animated animate__zoomIn" : ""}>
                  <img src={headerImg} alt="Изображение портфолио" />
                </div>
              )}
            </TrackVisibility>
          </Col>
        </Row>
      </Container>
    </section>
  );
};